import { randomBytes } from "node:crypto";

import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

const email = process.env.ADMIN_EMAIL ?? "admin@example.local";
const fullName = process.env.ADMIN_NAME ?? "Quản trị viên hệ thống";
const password = process.env.ADMIN_PASSWORD;
const requestedUsername = (process.env.ADMIN_USERNAME ?? "admin")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "") || "admin";

async function main() {
  if (!password) throw new Error("Thiếu ADMIN_PASSWORD. Hãy tự đặt mật khẩu quản trị trước khi chạy seed.");
  const existing = await db.query<{ id: string; username: string }>("SELECT id, username FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);
  const usernameOwner = await db.query<{ id: string }>("SELECT id FROM users WHERE lower(username) = lower($1) LIMIT 1", [requestedUsername]);
  const username = existing.rows[0]?.username
    ?? (usernameOwner.rows[0] ? `${requestedUsername}-${randomBytes(4).toString("hex")}` : requestedUsername);
  const passwordHash = await hashPassword(password);

  await db.query(
    `INSERT INTO users (full_name, username, email, password_hash, role_id, status)
     SELECT $1, $2, $3, $4, id, 'active' FROM roles WHERE code = 'admin'
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       password_hash = EXCLUDED.password_hash,
       role_id = EXCLUDED.role_id,
       status = 'active',
       disabled_at = NULL,
       purge_after = NULL,
       session_version = users.session_version + 1,
       updated_at = now()`,
    [fullName, username, email, passwordHash],
  );

  console.log("");
  console.log("✓ TÀI KHOẢN QUẢN TRỊ ĐÃ SẴN SÀNG");
  console.log(`Trạng thái: ${existing.rows[0] ? "Đã đặt lại mật khẩu tài khoản hiện có" : "Đã tạo tài khoản mới"}`);
  console.log(`URL:        ${process.env.APP_URL ?? "http://localhost:3000"}/login`);
  console.log(`Email:      ${email}`);
  console.log(`Đăng nhập:  ${username}`);
  console.log("Mật khẩu:   Đã thiết lập từ ADMIN_PASSWORD (không hiển thị trong terminal).");
  console.log("");
  console.log("Hãy đổi mật khẩu sau lần đăng nhập đầu tiên nếu đây là môi trường dùng chung.");
}

main()
  .catch((error) => { console.error("✗ Không thể tạo/đặt lại tài khoản quản trị:", error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => { await db.end(); });
