import { NextResponse } from "next/server";
import { z } from "zod";

import { createOtp, otpHash, RESET_TTL_SECONDS, setPasswordResetChallenge } from "@/lib/auth/password-reset";
import { query, withTransaction } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { checkPasswordResetRequest } from "@/lib/security/rate-limit";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
function isBlockedDomain(email: string) { const domain = email.split("@")[1]?.toLowerCase() ?? ""; return ["local", "localhost", "test", "invalid"].includes(domain.split(".").at(-1) ?? "") || domain === "example.local"; }

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nhập địa chỉ email hợp lệ." }, { status: 400 });
  const email = parsed.data.email;
  const limit = await checkPasswordResetRequest(request, email);
  if (!limit.allowed) return NextResponse.json({ error: "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  const user = await query<{ id: string }>("SELECT id FROM users WHERE lower(email)=lower($1) AND status='active' LIMIT 1", [email]);
  if (!user.rows[0]) return NextResponse.json({ error: "Email không tồn tại trong danh sách người dùng hoặc tài khoản không còn hoạt động." }, { status: 404 });
  if (isBlockedDomain(email)) return NextResponse.json({ error: "Email này không thể nhận mã xác thực. Vui lòng liên hệ quản trị viên." }, { status: 422 });
  try {
    const otp = createOtp();
    const requestId = await withTransaction(async (client) => {
      await client.query("UPDATE password_reset_requests SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL", [user.rows[0].id]);
      const created = await client.query<{ id: string }>(`INSERT INTO password_reset_requests(user_id,email,otp_hash,expires_at) VALUES($1,$2,'pending',now()+make_interval(secs=>$3::int)) RETURNING id`, [user.rows[0].id, email, RESET_TTL_SECONDS]);
      const id = created.rows[0]?.id;
      if (!id) throw new Error("CREATE_FAILED");
      await client.query("UPDATE password_reset_requests SET otp_hash=$1 WHERE id=$2", [otpHash(id, otp), id]);
      return id;
    });
    if (!requestId) throw new Error("CREATE_FAILED");
    await sendPasswordResetEmail(email, otp);
    await setPasswordResetChallenge(requestId);
    return NextResponse.json({ ok: true, message: "Mã xác thực đã được gửi đến email của bạn." });
  } catch { return NextResponse.json({ error: "Email này không thể gửi xác thực. Vui lòng liên hệ quản trị viên." }, { status: 422 }); }
}
