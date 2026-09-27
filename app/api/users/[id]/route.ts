import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { roleCodes, usernameSchema } from "@/lib/auth/users";
import { query, withTransaction } from "@/lib/db";
import { removeUserAvatar } from "@/lib/storage/user-avatar";

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  username: usernameSchema,
  email: z.string().trim().email().max(254),
  role: z.enum(roleCodes),
});
const disableSchema = z.object({
  transferToUserId: z.string().uuid(),
  ticketAssigneeId: z.string().uuid().optional(),
});

type Target = { id: string; role: "sales" | "technical" | "admin"; status: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const role = await query<{ id: string }>("SELECT id FROM roles WHERE code = $1", [parsed.data.role]);
    if (!role.rows[0]) return NextResponse.json({ error: "Vai trò không hợp lệ." }, { status: 400 });
    const result = await query(
      `UPDATE users SET full_name = $1, username = $2, email = $3, role_id = $4, updated_at = now()
       WHERE id = $5 AND status <> 'purged'
       RETURNING id`,
      [parsed.data.fullName, parsed.data.username, parsed.data.email, role.rows[0].id, id],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Không tìm thấy người dùng có thể điều chỉnh." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "Bạn không có quyền quản trị người dùng." }, { status: 403 });
    if (String(error).includes("users_username_ci_idx") || String(error).includes("users_email_key")) return NextResponse.json({ error: "Email hoặc tên đăng nhập đã được sử dụng." }, { status: 409 });
    return NextResponse.json({ error: "Không thể điều chỉnh người dùng." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;
    if (id === actor.userId) return NextResponse.json({ error: "Bạn không thể vô hiệu hóa chính tài khoản của mình." }, { status: 400 });
    const parsed = disableSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Cần chọn người nhận bài viết đang hoạt động." }, { status: 400 });
    await withTransaction(async (client) => {
      const targets = await client.query<Target>(
        `SELECT u.id, r.code AS role, u.status FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ANY($1::uuid[]) FOR UPDATE`,
        [[id, parsed.data.transferToUserId, parsed.data.ticketAssigneeId ?? parsed.data.transferToUserId]],
      );
      const removed = targets.rows.find((user) => user.id === id);
      const transferee = targets.rows.find((user) => user.id === parsed.data.transferToUserId);
      const ticketAssignee = targets.rows.find((user) => user.id === (parsed.data.ticketAssigneeId ?? parsed.data.transferToUserId));
      if (!removed || removed.status !== "active") throw new Error("TARGET_INVALID");
      if (!transferee || transferee.status !== "active" || transferee.id === id) throw new Error("TRANSFER_INVALID");
      if (!ticketAssignee || ticketAssignee.status !== "active" || ticketAssignee.role === "sales") throw new Error("TICKET_ASSIGNEE_INVALID");
      if (removed.role === "admin") {
        const admins = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'admin' AND u.status = 'active'`);
        if (Number(admins.rows[0]?.count ?? 0) <= 1) throw new Error("LAST_ADMIN");
      }
      await client.query("UPDATE knowledge_articles SET created_by = $1, reviewed_by = CASE WHEN reviewed_by = $2 THEN $1 ELSE reviewed_by END, updated_at = now() WHERE created_by = $2 OR reviewed_by = $2", [transferee.id, id]);
      await client.query("UPDATE unanswered_questions SET assigned_to = $1, updated_at = now() WHERE assigned_to = $2 AND status IN ('new', 'in_review')", [ticketAssignee.id, id]);
      await client.query("DELETE FROM user_mfa_totp WHERE user_id = $1", [id]);
      await client.query(
        `UPDATE users SET status = 'disabled', disabled_at = now(), purge_after = now() + interval '30 days',
          session_version = session_version + 1, avatar_key = NULL, avatar_content_type = NULL, avatar_size_bytes = NULL, mfa_enabled_at = NULL, updated_at = now()
         WHERE id = $1`, [id],
      );
      await client.query("INSERT INTO user_lifecycle_events(user_id, actor_id, event_type, details) VALUES ($1, $2, 'ownership_transferred', $3::jsonb), ($1, $2, 'disabled', $4::jsonb)", [id, actor.userId, JSON.stringify({ transferToUserId: transferee.id, ticketAssigneeId: ticketAssignee.id }), JSON.stringify({ purgeAfterDays: 30 })]);
    });
    await removeUserAvatar(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "LAST_ADMIN" ? "Không thể vô hiệu hóa Quản trị viên đang hoạt động cuối cùng." : code === "TARGET_INVALID" ? "Tài khoản này không thể vô hiệu hóa." : code === "TRANSFER_INVALID" ? "Người nhận bài viết phải là tài khoản đang hoạt động khác." : code === "TICKET_ASSIGNEE_INVALID" ? "Người xử lý ticket phải đang hoạt động." : "Không thể vô hiệu hóa người dùng.";
    return NextResponse.json({ error: message }, { status: code === "FORBIDDEN" ? 403 : 400 });
  }
}
