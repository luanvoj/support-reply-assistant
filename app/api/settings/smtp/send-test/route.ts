import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { sendSmtpTestEmail } from "@/lib/mailer";
import { getUserLogSnapshot, writeOperationalLog } from "@/lib/operational-log";

const schema = z.object({ to: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  try {
    const actor = await requireRole("admin");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Nhập một email nhận hợp lệ." }, { status: 400 });
    await sendSmtpTestEmail(parsed.data.to);
    const snapshot = await getUserLogSnapshot(actor.userId);
    await writeOperationalLog({
      category: "configuration",
      action: "smtp_test_email_sent",
      summary: `${snapshot.username} đã gửi email test SMTP`,
      actorUserId: actor.userId,
      actorSnapshot: snapshot,
      details: {},
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "FORBIDDEN" ? "Bạn không có quyền gửi email test SMTP." : code === "SMTP_NOT_CONFIGURED" ? "Hãy lưu cấu hình SMTP trước khi gửi email test." : "Không thể gửi email test. Hãy kiểm tra cấu hình SMTP hoặc egress firewall." }, { status: code === "FORBIDDEN" ? 403 : code === "SMTP_NOT_CONFIGURED" ? 409 : 502 });
  }
}
