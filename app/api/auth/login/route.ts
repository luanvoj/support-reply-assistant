import { NextResponse } from "next/server";
import { z } from "zod";

import { createMfaPendingSession, createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { query } from "@/lib/db";
import { writeOperationalLog } from "@/lib/operational-log";
import { checkLoginRequest, clearLoginFailures, recordLoginFailure } from "@/lib/security/rate-limit";

const loginSchema = z.object({
  identity: z.string().trim().min(3).max(254),
  password: z.string().min(8),
});

type UserRow = { id: string; email: string; username: string; full_name: string; password_hash: string; role: "sales" | "technical" | "admin"; session_version: number; mfa_enabled_at: string | null };

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  const rateLimit = await checkLoginRequest(request, parsed.data.identity);
  if (!rateLimit.allowed) return NextResponse.json({ error: "Invalid credentials" }, { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } });

  const result = await query<UserRow>(
    `SELECT u.id, u.email, u.username, u.full_name, u.password_hash, u.session_version, u.mfa_enabled_at, r.code AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE (lower(u.email) = lower($1) OR lower(u.username) = lower($1)) AND u.status = 'active'
     LIMIT 1`,
    [parsed.data.identity],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) {
    const failure = await recordLoginFailure(request, parsed.data.identity);
    if (!failure.allowed) return NextResponse.json({ error: "Invalid credentials" }, { status: 429, headers: { "retry-after": String(failure.retryAfterSeconds) } });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await clearLoginFailures(request, parsed.data.identity);

  const payload = { userId: user.id, email: user.email, role: user.role, sessionVersion: user.session_version };
  if (user.mfa_enabled_at) {
    await createMfaPendingSession(payload);
    return NextResponse.json({ mfaRequired: true });
  }
  await createSession(payload);
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await writeOperationalLog({ category: "authentication", action: "login_succeeded", summary: `${user.username} đã đăng nhập`, actorUserId: user.id, actorSnapshot: { fullName: user.full_name, username: user.username, email: user.email, role: user.role } });
  return NextResponse.json({ user: { id: user.id, email: user.email, username: user.username, role: user.role } });
}
