import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db";
import { getUserLogSnapshot, writeOperationalLog } from "@/lib/operational-log";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;
    if (id === actor.userId) return NextResponse.json({ error: "Bạn không thể vô hiệu hóa chính tài khoản của mình." }, { status: 400 });
    await withTransaction(async (client) => {
      const result = await client.query<{ full_name: string; username: string; role: string }>("SELECT u.full_name,u.username,r.code AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.status='active' FOR UPDATE", [id]);
      const target = result.rows[0];
      if (!target) throw new Error("TARGET");
      await client.query("UPDATE users SET status='disabled',disabled_at=now(),purge_after=NULL,session_version=session_version+1,updated_at=now() WHERE id=$1", [id]);
      await client.query("INSERT INTO user_lifecycle_events(user_id,actor_id,event_type,details) VALUES($1,$2,'disabled',$3::jsonb)", [id, actor.userId, JSON.stringify({ by: "admin" })]);
      const actorSnapshot = await getUserLogSnapshot(actor.userId, client);
      await writeOperationalLog({ category: "account", action: "user_disabled", summary: `${actorSnapshot.username} đã vô hiệu hóa tài khoản ${target.username}`, actorUserId: actor.userId, actorSnapshot, targetUserId: id, targetSnapshot: { fullName: target.full_name, username: target.username, role: target.role } }, client);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json({ error: forbidden ? "Bạn không có quyền quản trị người dùng." : "Chỉ có thể vô hiệu hóa tài khoản đang hoạt động." }, { status: forbidden ? 403 : 400 });
  }
}
