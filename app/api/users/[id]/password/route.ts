import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { passwordSchema, passwordStrength } from "@/lib/auth/users";
import { withTransaction } from "@/lib/db";

const schema = z.object({ password: passwordSchema, passwordConfirmation: z.string() }).refine((value) => value.password === value.passwordConfirmation, { path: ["passwordConfirmation"], message: "Hai mật khẩu chưa trùng khớp." });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;
    if (id === actor.userId) return NextResponse.json({ error: "Hãy dùng Thông tin người dùng để đổi mật khẩu của chính bạn." }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || passwordStrength(parsed.data.password) === "weak") return NextResponse.json({ error: parsed.success ? "Mật khẩu cần đạt mức Trung bình trở lên." : parsed.error.flatten() }, { status: 400 });
    await withTransaction(async (client) => {
      const target = await client.query<{ status: string }>("SELECT status FROM users WHERE id=$1 FOR UPDATE", [id]);
      if (target.rows[0]?.status !== "active") throw new Error("TARGET_NOT_ACTIVE");
      await client.query("UPDATE users SET password_hash=$1, session_version=session_version+1, updated_at=now() WHERE id=$2", [await hashPassword(parsed.data.password), id]);
      await client.query("INSERT INTO user_lifecycle_events(user_id, actor_id, event_type, details) VALUES ($1,$2,'password_reset_by_admin',$3::jsonb)", [id, actor.userId, JSON.stringify({ by: "admin" })]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "TARGET_NOT_ACTIVE" ? "Chỉ có thể đặt lại mật khẩu cho tài khoản đang hoạt động." : code === "FORBIDDEN" ? "Bạn không có quyền quản trị người dùng." : "Không thể đặt lại mật khẩu." }, { status: code === "FORBIDDEN" ? 403 : 400 });
  }
}
