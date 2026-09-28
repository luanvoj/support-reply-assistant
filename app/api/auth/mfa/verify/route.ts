import { NextResponse } from "next/server";
import { z } from "zod";

import { clearMfaPendingSession, createSession, getMfaPendingSession, getMfaPendingSessionFingerprint } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/mfa";
import { query } from "@/lib/db";
import { getUserLogSnapshot, writeOperationalLog } from "@/lib/operational-log";
import { checkMfaRequest, clearMfaFailures, recordMfaFailure } from "@/lib/security/rate-limit";
import { decryptSecret } from "@/lib/security/secrets";

const schema = z.object({ code: z.string().regex(/^\d{6}$/) });
const expired = "Phiên xác thực đã hết hạn. Hãy đăng nhập lại.";

export async function POST(request: Request) {
  const pending = await getMfaPendingSession();
  const challengeFingerprint = await getMfaPendingSessionFingerprint();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!pending || !challengeFingerprint || !parsed.success) return NextResponse.json({ error: expired }, { status: 401 });

  const rateLimit = await checkMfaRequest(request, challengeFingerprint);
  if (!rateLimit.allowed) {
    await clearMfaPendingSession();
    return NextResponse.json({ error: expired }, { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } });
  }

  const factor = await query<{ secret_encrypted: string; verified_at: string | null; last_verified_counter: string | null }>(
    "SELECT secret_encrypted, verified_at, last_verified_counter FROM user_mfa_totp WHERE user_id = $1", [pending.userId],
  );
  const record = factor.rows[0];
  if (!record?.verified_at) return NextResponse.json({ error: "Xác thực hai bước chưa sẵn sàng. Hãy đăng nhập lại." }, { status: 401 });

  const counter = verifyTotp(decryptSecret(record.secret_encrypted), parsed.data.code);
  if (counter === null || String(counter) === record.last_verified_counter) {
    const failure = await recordMfaFailure(request, challengeFingerprint);
    if (!failure.allowed) await clearMfaPendingSession();
    return NextResponse.json(
      { error: "Mã xác thực không đúng hoặc đã được dùng." },
      { status: failure.allowed ? 401 : 429, headers: failure.allowed ? undefined : { "retry-after": String(failure.retryAfterSeconds) } },
    );
  }

  const current = await query<{ status: string; session_version: number }>("SELECT status, session_version FROM users WHERE id = $1", [pending.userId]);
  if (!current.rows[0] || current.rows[0].status !== "active" || current.rows[0].session_version !== pending.sessionVersion) return NextResponse.json({ error: "Phiên đăng nhập không còn hiệu lực." }, { status: 401 });

  await query("UPDATE user_mfa_totp SET last_verified_counter = $2, updated_at = now() WHERE user_id = $1", [pending.userId, counter]);
  await clearMfaFailures(request, challengeFingerprint);
  await createSession(pending);
  const snapshot = await getUserLogSnapshot(pending.userId);
  await writeOperationalLog({ category: "authentication", action: "login_succeeded_mfa", summary: `${snapshot.username ?? "Người dùng"} đã đăng nhập với xác thực hai bước`, actorUserId: pending.userId, actorSnapshot: snapshot });
  await clearMfaPendingSession();
  return NextResponse.json({ ok: true });
}
