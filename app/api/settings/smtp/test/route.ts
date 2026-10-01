import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { verifySmtpDraft } from "@/lib/mailer";
import { assertSafeSmtpHost } from "@/lib/security/smtp-host";

const schema = z.object({ host: z.string().trim().min(1).max(253), port: z.coerce.number().int().min(1).max(65535), secure: z.boolean(), username: z.string().trim().min(1).max(254), password: z.string().min(1).max(1024) });

export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Nhập đầy đủ host, port, username và mật khẩu SMTP trước khi kiểm tra." }, { status: 400 });
    await assertSafeSmtpHost(parsed.data.host);
    await verifySmtpDraft(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unsafe = error instanceof Error && error.message === "SMTP_UNSAFE_HOST";
    return NextResponse.json({ error: unsafe ? "SMTP chỉ hỗ trợ hostname public an toàn. Gmail dùng smtp.gmail.com, không phải smtp.google.com." : "Không thể kết nối SMTP trong 10 giây. Kiểm tra host, port, TLS, App Password hoặc egress firewall." }, { status: unsafe ? 400 : 502 });
  }
}
