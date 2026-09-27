import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;
    if (id === actor.userId) return NextResponse.json({ error: "Hãy dùng Thông tin người dùng để tắt 2FA của chính bạn." }, { status: 400 });
    await withTransaction(async (client) => {
      const target = await client.query<{ status: string; mfa_enabled_at: string | null }>("SELECT status, mfa_enabled_at FROM users WHERE id=$1 FOR UPDATE", [id]);
      if (target.rows[0]?.status !== "active") throw new Error("TARGET_NOT_ACTIVE");
      if (!target.rows[0].mfa_enabled_at) throw new Error("MFA_NOT_ENABLED");
      await client.query("DELETE FROM user_mfa_totp WHERE user_id=$1", [id]);
      await client.query("UPDATE users SET mfa_enabled_at=NULL, session_version=session_version+1, updated_at=now() WHERE id=$1", [id]);
      await client.query("INSERT INTO user_lifecycle_events(user_id, actor_id, event_type, details) VALUES ($1,$2,'mfa_disabled',$3::jsonb)", [id, actor.userId, JSON.stringify({ by: "admin_recovery" })]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "MFA_NOT_ENABLED" ? "Tài khoản này chưa bật 2FA." : code === "TARGET_NOT_ACTIVE" ? "Chỉ có thể tắt 2FA cho tài khoản đang hoạt động." : code === "FORBIDDEN" ? "Bạn không có quyền quản trị người dùng." : "Không thể tắt 2FA." }, { status: code === "FORBIDDEN" ? 403 : 400 });
  }
}
