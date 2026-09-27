import { NextResponse } from "next/server";
import { z } from "zod";

import { clearMfaPendingSession, createSession, getMfaPendingSession } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/mfa";
import { query } from "@/lib/db";
import { decryptSecret } from "@/lib/security/secrets";

const schema = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  const pending = await getMfaPendingSession();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!pending || !parsed.success) return NextResponse.json({ error: "Phiên xác thực đã hết hạn. Hãy đăng nhập lại." }, { status: 401 });
  const factor = await query<{ secret_encrypted: string; verified_at: string | null; last_verified_counter: string | null }>(
    `SELECT secret_encrypted, verified_at, last_verified_counter FROM user_mfa_totp WHERE user_id = $1`, [pending.userId],
  );
  const record = factor.rows[0];
  if (!record?.verified_at) return NextResponse.json({ error: "Xác thực hai bước chưa sẵn sàng. Hãy đăng nhập lại." }, { status: 401 });
  const counter = verifyTotp(decryptSecret(record.secret_encrypted), parsed.data.code);
  if (counter === null || String(counter) === record.last_verified_counter) return NextResponse.json({ error: "Mã xác thực không đúng hoặc đã được dùng." }, { status: 401 });
  const current = await query<{ status: string; session_version: number }>("SELECT status, session_version FROM users WHERE id = $1", [pending.userId]);
  if (!current.rows[0] || current.rows[0].status !== "active" || current.rows[0].session_version !== pending.sessionVersion) return NextResponse.json({ error: "Phiên đăng nhập không còn hiệu lực." }, { status: 401 });
  await query("UPDATE user_mfa_totp SET last_verified_counter = $2, updated_at = now() WHERE user_id = $1", [pending.userId, counter]);
  await createSession(pending);
  await clearMfaPendingSession();
  return NextResponse.json({ ok: true });
}
