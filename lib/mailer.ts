import nodemailer from "nodemailer";

import { query } from "@/lib/db";
import { decryptSecret } from "@/lib/security/secrets";
import { connectSafeSmtpSocket, normalizeSmtpHost } from "@/lib/security/smtp-host";

type SmtpRow = { host: string | null; port: number | null; secure: boolean; username: string | null; password_encrypted: string | null; from_email: string | null; from_name: string | null };
type SmtpConfig = { host: string; port: number; secure: boolean; username: string; password_encrypted: string; from_email: string; from_name: string | null };
type SmtpConnection = { host: string; port: number; secure: boolean; username: string; password: string };
export type SmtpDraft = SmtpConnection;

export async function getSmtpSettings() {
  const result = await query<SmtpRow>("SELECT host,port,secure,username,password_encrypted,from_email,from_name FROM smtp_settings WHERE id=true");
  return result.rows[0] ?? null;
}

export function smtpConfigured(settings: SmtpRow | null): settings is SmtpConfig {
  return Boolean(settings?.host && settings.port && settings.username && settings.password_encrypted && settings.from_email);
}

function smtpTransport(settings: SmtpConnection) {
  const host = normalizeSmtpHost(settings.host);
  return nodemailer.createTransport({
    host,
    port: settings.port,
    secure: settings.secure,
    requireTLS: !settings.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: { servername: host },
    auth: { user: settings.username, pass: settings.password },
    getSocket: (_options, callback) => {
      void connectSafeSmtpSocket(host, settings.port, 10_000).then(
        (connection) => callback(null, { connection }),
        (error: unknown) => callback(error instanceof Error ? error : new Error("SMTP_CONNECTION_FAILED"), false),
      );
    },
  });
}

function transporter(settings: SmtpConfig) {
  return smtpTransport({ host: settings.host, port: settings.port, secure: settings.secure, username: settings.username, password: decryptSecret(settings.password_encrypted) });
}

export async function verifySmtpDraft(settings: SmtpDraft) { await smtpTransport(settings).verify(); }
export async function verifySmtpSettings(settings: SmtpConfig) { await transporter(settings).verify(); }

export async function sendPasswordResetEmail(to: string, code: string) {
  const settings = await getSmtpSettings();
  if (!smtpConfigured(settings)) throw new Error("SMTP_NOT_CONFIGURED");
  await transporter(settings).sendMail({ from: settings.from_name ? { name: settings.from_name, address: settings.from_email } : settings.from_email, to, subject: "Mã xác thực đặt lại mật khẩu", text: `Mã xác thực đặt lại mật khẩu của bạn là ${code}. Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.` });
}

export async function sendSmtpTestEmail(to: string) {
  const settings = await getSmtpSettings();
  if (!smtpConfigured(settings)) throw new Error("SMTP_NOT_CONFIGURED");
  await transporter(settings).sendMail({ from: settings.from_name ? { name: settings.from_name, address: settings.from_email } : settings.from_email, to, subject: "Kiểm tra cấu hình SMTP", text: "Đây là email kiểm tra từ hệ thống Trợ lý phản hồi. Nếu bạn nhận được email này, cấu hình SMTP đang hoạt động." });
}
