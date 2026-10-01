import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { query } from "@/lib/db";
import { getUserLogSnapshot, writeOperationalLog } from "@/lib/operational-log";
import { encryptSecret } from "@/lib/security/secrets";
import { assertSafeSmtpHost } from "@/lib/security/smtp-host";

const schema = z.object({ host: z.string().trim().min(1).max(253), port: z.coerce.number().int().min(1).max(65535), secure: z.boolean(), username: z.string().trim().min(1).max(254), password: z.string().max(1024).optional(), fromEmail: z.string().trim().email().max(254), fromName: z.string().trim().min(1).max(120) });

export async function GET() {
  try {
    await requireRole("admin");
    const result = await query<{ host: string | null; port: number | null; secure: boolean; username: string | null; from_email: string | null; from_name: string | null; configured: boolean }>("SELECT host,port,secure,username,from_email,from_name,password_encrypted IS NOT NULL AS configured FROM smtp_settings WHERE id=true");
    const smtp = result.rows[0];
    return NextResponse.json({ smtp: smtp ? { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, fromEmail: smtp.from_email, fromName: smtp.from_name, configured: smtp.configured } : null });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền xem cấu hình SMTP." }, { status: 403 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireRole("admin");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    await assertSafeSmtpHost(input.host);
    const existing = await query<{ password_encrypted: string | null }>("SELECT password_encrypted FROM smtp_settings WHERE id=true");
    const password = input.password?.trim() ? encryptSecret(input.password) : existing.rows[0]?.password_encrypted;
    if (!password) return NextResponse.json({ error: "Nhập mật khẩu SMTP khi cấu hình lần đầu." }, { status: 400 });
    await query("UPDATE smtp_settings SET host=$1,port=$2,secure=$3,username=$4,password_encrypted=$5,from_email=$6,from_name=$7,updated_by=$8,updated_at=now() WHERE id=true", [input.host, input.port, input.secure, input.username, password, input.fromEmail, input.fromName, actor.userId]);
    const snapshot = await getUserLogSnapshot(actor.userId);
    await writeOperationalLog({ category: "configuration", action: "smtp_settings_updated", summary: `${snapshot.username} đã cập nhật cấu hình SMTP`, actorUserId: actor.userId, actorSnapshot: snapshot, details: { host: input.host, port: input.port, secure: input.secure, fromEmail: input.fromEmail } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unsafe = error instanceof Error && error.message === "SMTP_UNSAFE_HOST";
    return NextResponse.json({ error: unsafe ? "SMTP chỉ hỗ trợ hostname public an toàn, không hỗ trợ localhost hoặc mạng nội bộ." : "Không thể lưu cấu hình SMTP." }, { status: unsafe ? 400 : 500 });
  }
}
