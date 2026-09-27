import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/guard";
import { passwordSchema, passwordStrength, roleLabel } from "@/lib/auth/users";
import { query } from "@/lib/db";

type ProfileRow = { id: string; full_name: string; username: string; email: string; role: string; avatar_key: string | null; mfa_enabled_at: string | null };

export async function GET() {
  try {
    const session = await requireRole("sales", "technical", "admin");
    const result = await query<ProfileRow>(
      `SELECT u.id, u.full_name, u.username, u.email, r.code AS role, u.avatar_key, u.mfa_enabled_at
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [session.userId],
    );
    const user = result.rows[0];
    if (!user) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
    return NextResponse.json({ profile: { id: user.id, fullName: user.full_name, username: user.username, email: user.email, role: user.role, roleLabel: roleLabel(user.role), hasAvatar: Boolean(user.avatar_key), avatarUrl: user.avatar_key ? "/api/profile/avatar" : null, mfaEnabled: Boolean(user.mfa_enabled_at) } });
  } catch {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }
}

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  password: passwordSchema,
  passwordConfirmation: z.string(),
}).refine((value) => value.password === value.passwordConfirmation, { path: ["passwordConfirmation"], message: "Hai mật khẩu chưa trùng khớp." });

export async function PATCH(request: Request) {
  try {
    const session = await requireRole("sales", "technical", "admin");
    const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    if (passwordStrength(parsed.data.password) === "weak") return NextResponse.json({ error: "Mật khẩu cần đạt mức Trung bình trở lên." }, { status: 400 });
    const current = await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [session.userId]);
    if (!current.rows[0] || !(await verifyPassword(parsed.data.currentPassword, current.rows[0].password_hash))) return NextResponse.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
    await query("UPDATE users SET password_hash = $1, session_version = session_version + 1, updated_at = now() WHERE id = $2", [await hashPassword(parsed.data.password), session.userId]);
    await query("INSERT INTO user_lifecycle_events(user_id, actor_id, event_type, details) VALUES ($1, $1, 'updated', $2::jsonb)", [session.userId, JSON.stringify({ passwordChanged: true })]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Không thể đổi mật khẩu." }, { status: 500 });
  }
}
