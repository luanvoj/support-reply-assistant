import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { roleCodes, usernameSchema } from "@/lib/auth/users";
import { query, withTransaction } from "@/lib/db";
import { getUserLogSnapshot, writeOperationalLog } from "@/lib/operational-log";
import { removeUserAvatar } from "@/lib/storage/user-avatar";

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(120), username: usernameSchema,
  email: z.string().trim().email().max(254), role: z.enum(roleCodes),
});
const deleteSchema = z.object({ successorId: z.string().uuid() });
type Role = "sales" | "technical" | "admin";
type UserRow = { id: string; full_name: string; username: string; role: Role; status: string; avatar_key: string | null };
const allowedSuccessors = (role: Role): Role[] => role === "sales" ? ["sales", "technical", "admin"] : role === "technical" ? ["technical", "admin"] : ["admin"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const role = await query<{ id: string }>("SELECT id FROM roles WHERE code=$1", [parsed.data.role]);
    const updated = await query<UserRow>(
      `UPDATE users SET full_name=$1,username=$2,email=$3,role_id=$4,updated_at=now()
       WHERE id=$5 AND status <> 'purged'
       RETURNING id,full_name,username,$6::user_role AS role,status,avatar_key`,
      [parsed.data.fullName, parsed.data.username, parsed.data.email, role.rows[0]?.id, id, parsed.data.role],
    );
    if (!updated.rowCount) return NextResponse.json({ error: "Không tìm thấy người dùng có thể điều chỉnh." }, { status: 404 });
    const actorSnapshot = await getUserLogSnapshot(actor.userId);
    await writeOperationalLog({ category: "account", action: "user_updated", summary: `${actorSnapshot.username} đã điều chỉnh tài khoản ${updated.rows[0].username}`, actorUserId: actor.userId, actorSnapshot, targetUserId: id, targetSnapshot: { fullName: updated.rows[0].full_name, username: updated.rows[0].username, role: updated.rows[0].role } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Bạn không có quyền quản trị người dùng." : "Không thể điều chỉnh người dùng." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;
    if (id === actor.userId) return NextResponse.json({ error: "Bạn không thể xóa chính tài khoản của mình." }, { status: 400 });
    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Cần chọn tài khoản kế thừa hợp lệ." }, { status: 400 });

    const avatarKey = await withTransaction(async (client) => {
      const found = await client.query<UserRow>(
        `SELECT u.id,u.full_name,u.username,r.code AS role,u.status,u.avatar_key
         FROM users u JOIN roles r ON r.id=u.role_id
         WHERE u.id = ANY($1::uuid[]) FOR UPDATE`, [[id, parsed.data.successorId]],
      );
      const target = found.rows.find((row) => row.id === id);
      const successor = found.rows.find((row) => row.id === parsed.data.successorId);
      if (!target || target.status !== "active") throw new Error("TARGET");
      if (!successor || successor.status !== "active" || !allowedSuccessors(target.role).includes(successor.role)) throw new Error("SUCCESSOR");
      if (target.role === "admin") {
        const admins = await client.query<{ count: string }>(`SELECT count(*)::text count FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='admin' AND u.status='active'`);
        if (Number(admins.rows[0]?.count) <= 1) throw new Error("LAST_ADMIN");
      }
      const actorSnapshot = await getUserLogSnapshot(actor.userId, client);
      const targetSnapshot = { fullName: target.full_name, username: target.username, role: target.role };
      const successorSnapshot = { fullName: successor.full_name, username: successor.username, role: successor.role };

      const articles = await client.query(`UPDATE knowledge_articles SET created_by=$1, reviewed_by=CASE WHEN reviewed_by=$2 THEN $1 ELSE reviewed_by END, updated_at=now() WHERE created_by=$2 OR reviewed_by=$2`, [successor.id, target.id]);
      const tickets = await client.query(`UPDATE unanswered_questions SET created_by=$1, assigned_to=CASE WHEN assigned_to=$2 THEN $1 ELSE assigned_to END, updated_at=now() WHERE created_by=$2 OR assigned_to=$2`, [successor.id, target.id]);
      await client.query("UPDATE question_reviews SET reviewer_id=$1 WHERE reviewer_id=$2", [successor.id, target.id]);
      await client.query("UPDATE assistant_profiles SET created_by=COALESCE(created_by,$1), updated_by=CASE WHEN updated_by=$2 THEN $1 ELSE updated_by END WHERE created_by=$2 OR updated_by=$2", [successor.id, target.id]);
      await client.query("UPDATE retrieval_settings SET created_by=COALESCE(created_by,$1), updated_by=CASE WHEN updated_by=$2 THEN $1 ELSE updated_by END WHERE created_by=$2 OR updated_by=$2", [successor.id, target.id]);
      await client.query("UPDATE ai_provider_settings SET created_by=$1, updated_by=CASE WHEN updated_by=$2 THEN $1 ELSE updated_by END WHERE created_by=$2 OR updated_by=$2", [successor.id, target.id]);
      await client.query("UPDATE knowledge_import_batches SET created_by=$1 WHERE created_by=$2", [successor.id, target.id]);
      await client.query("UPDATE knowledge_merge_runs SET created_by=$1, approved_by=CASE WHEN approved_by=$2 THEN $1 ELSE approved_by END WHERE created_by=$2 OR approved_by=$2", [successor.id, target.id]);
      await client.query("UPDATE knowledge_merge_batches SET created_by=$1 WHERE created_by=$2", [successor.id, target.id]);
      await client.query("UPDATE knowledge_merge_pair_decisions SET decided_by=$1 WHERE decided_by=$2", [successor.id, target.id]);
      await client.query("UPDATE knowledge_article_audits SET actor_id=NULL WHERE actor_id=$1", [target.id]);

      // Chat is deliberately private: delete conversations and all dependent feedback, tickets and messages.
      await client.query("DELETE FROM feedback_logs WHERE user_id=$1", [target.id]);
      await client.query("DELETE FROM unanswered_questions WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id=$1)", [target.id]);
      await client.query("DELETE FROM conversations WHERE user_id=$1", [target.id]);
      await client.query("DELETE FROM user_lifecycle_events WHERE user_id=$1 OR actor_id=$1", [target.id]);
      await client.query("DELETE FROM user_mfa_totp WHERE user_id=$1", [target.id]);

      await writeOperationalLog({
        category: "account", action: "user_hard_deleted",
        summary: `${actorSnapshot.username} đã xóa tài khoản ${target.username}`,
        actorUserId: actor.userId, actorSnapshot, targetUserId: target.id, targetSnapshot,
        details: { successor: successorSnapshot, transferredArticles: articles.rowCount ?? 0, transferredQuestions: tickets.rowCount ?? 0 },
      }, client);
      await client.query("DELETE FROM users WHERE id=$1", [target.id]);
      return target.avatar_key;
    });
    if (avatarKey) await removeUserAvatar(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "LAST_ADMIN" ? "Không thể xóa Quản trị viên đang hoạt động cuối cùng." : code === "SUCCESSOR" ? "Tài khoản kế thừa không đúng cấp hoặc không còn hoạt động." : code === "TARGET" ? "Tài khoản này không thể xóa." : code === "FORBIDDEN" ? "Bạn không có quyền quản trị người dùng." : "Không thể xóa tài khoản.";
    return NextResponse.json({ error: message }, { status: code === "FORBIDDEN" ? 403 : 400 });
  }
}
