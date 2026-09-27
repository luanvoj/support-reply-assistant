import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { createTotpSecret, enrollmentUri, verifyTotp } from "@/lib/auth/mfa";
import { verifyPassword } from "@/lib/auth/password";
import { query, withTransaction } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

const setupSchema = z.object({ action: z.literal("setup") });
const verifySchema = z.object({ action: z.literal("verify"), code: z.string().regex(/^\d{6}$/, "Nhập mã gồm 6 chữ số.") });
const disableSchema = z.object({ action: z.literal("disable"), currentPassword: z.string().min(1) });
const actionSchema = z.discriminatedUnion("action", [setupSchema, verifySchema, disableSchema]);

export async function POST(request: Request) {
  try {
    const session = await requireRole("sales", "technical", "admin");
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const user = await query<{ full_name: string; email: string; password_hash: string }>("SELECT full_name, email, password_hash FROM users WHERE id = $1 AND status = 'active'", [session.userId]);
    const account = user.rows[0];
    if (!account) return NextResponse.json({ error: "Không tìm thấy tài khoản đang hoạt động." }, { status: 404 });
    if (parsed.data.action === "setup") {
      const secret = createTotpSecret();
      const uri = enrollmentUri(account.email || account.full_name, secret);
      await query(
        `INSERT INTO user_mfa_totp(user_id, secret_encrypted, recovery_code_hashes, verified_at, verification_attempts, updated_at)
         VALUES ($1, $2, '[]'::jsonb, NULL, 0, now())
         ON CONFLICT(user_id) DO UPDATE SET secret_encrypted = EXCLUDED.secret_encrypted, recovery_code_hashes = '[]'::jsonb, verified_at = NULL, verification_attempts = 0, last_verified_counter = NULL, updated_at = now()`,
        [session.userId, encryptSecret(secret)],
      );
      return NextResponse.json({ uri, qrCodeDataUrl: await QRCode.toDataURL(uri, { width: 220, margin: 1, errorCorrectionLevel: "M" }) });
    }
    if (parsed.data.action === "verify") {
      const verificationCode = parsed.data.code;
      const result = await withTransaction(async (client) => {
        const record = await client.query<{ secret_encrypted: string; verification_attempts: number; last_verified_counter: string | null }>("SELECT secret_encrypted, verification_attempts, last_verified_counter FROM user_mfa_totp WHERE user_id = $1 FOR UPDATE", [session.userId]);
        const factor = record.rows[0];
        if (!factor || factor.verification_attempts >= 5) throw new Error(factor ? "TOO_MANY_ATTEMPTS" : "MFA_SETUP_MISSING");
        const counter = verifyTotp(decryptSecret(factor.secret_encrypted), verificationCode);
        if (counter === null || String(counter) === factor.last_verified_counter) {
          await client.query("UPDATE user_mfa_totp SET verification_attempts = verification_attempts + 1, updated_at = now() WHERE user_id = $1", [session.userId]);
          throw new Error("INVALID_CODE");
        }
        await client.query("UPDATE user_mfa_totp SET verified_at = now(), verification_attempts = 0, last_verified_counter = $2, updated_at = now() WHERE user_id = $1", [session.userId, counter]);
        await client.query("UPDATE users SET mfa_enabled_at = now(), updated_at = now() WHERE id = $1", [session.userId]);
        await client.query("INSERT INTO user_lifecycle_events(user_id, actor_id, event_type, details) VALUES ($1, $1, 'updated', $2::jsonb)", [session.userId, JSON.stringify({ mfaEnabled: true })]);
        return true;
      });
      return NextResponse.json({ ok: result });
    }
    if (!(await verifyPassword(parsed.data.currentPassword, account.password_hash))) return NextResponse.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
    await withTransaction(async (client) => {
      await client.query("DELETE FROM user_mfa_totp WHERE user_id = $1", [session.userId]);
      await client.query("UPDATE users SET mfa_enabled_at = NULL, session_version = session_version + 1, updated_at = now() WHERE id = $1", [session.userId]);
      await client.query("INSERT INTO user_lifecycle_events(user_id, actor_id, event_type, details) VALUES ($1, $1, 'mfa_disabled', $2::jsonb)", [session.userId, JSON.stringify({ by: "self" })]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "TOO_MANY_ATTEMPTS" ? "Bạn đã nhập sai quá nhiều lần. Hãy bắt đầu thiết lập lại 2FA." : code === "MFA_SETUP_MISSING" ? "Phiên thiết lập đã hết hạn. Hãy bắt đầu lại." : code === "INVALID_CODE" ? "Mã xác thực không đúng hoặc đã được dùng." : "Không thể cập nhật xác thực hai bước.";
    return NextResponse.json({ error: message }, { status: code === "FORBIDDEN" ? 403 : 400 });
  }
}
