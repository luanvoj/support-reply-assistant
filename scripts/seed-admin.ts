import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordSchema, passwordStrength, usernameSchema } from "@/lib/auth/users";
import { db, withTransaction } from "@/lib/db";
import { clearLoginFailuresForIdentity } from "@/lib/security/rate-limit";

const defaultAdmin = {
  email: "admin@example.local",
  fullName: "System Administrator",
  username: "admin",
} as const;

const adminSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().min(2).max(120),
  username: usernameSchema,
  password: passwordSchema,
});

function readAdminInput() {
  const parsed = adminSchema.safeParse({
    email: process.env.ADMIN_EMAIL ?? defaultAdmin.email,
    fullName: process.env.ADMIN_FULL_NAME ?? defaultAdmin.fullName,
    username: process.env.ADMIN_USERNAME ?? defaultAdmin.username,
    password: process.env.ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    throw new Error(`Invalid admin input: ${parsed.error.issues.map((issue) => issue.message).join(" ")}`);
  }
  if (passwordStrength(parsed.data.password) === "weak") {
    throw new Error("Invalid admin input: password must meet the application's minimum strength.");
  }
  return parsed.data;
}

async function main() {
  const admin = readAdminInput();
  const passwordHash = await hashPassword(admin.password);

  const result = await withTransaction(async (client) => {
    const role = await client.query<{ id: string }>("SELECT id FROM roles WHERE code = 'admin'");
    const roleId = role.rows[0]?.id;
    if (!roleId) throw new Error("Admin role is missing. Run db:migrate first.");

    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1 FOR UPDATE",
      [admin.email],
    );
    const usernameOwner = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(username) = lower($1) FOR UPDATE",
      [admin.username],
    );
    if (usernameOwner.rows[0] && usernameOwner.rows[0].id !== existing.rows[0]?.id) {
      throw new Error("ADMIN_USERNAME is already used by a different account.");
    }

    if (existing.rows[0]) {
      const updated = await client.query<{ password_hash: string }>(
        `UPDATE users
         SET full_name = $1, username = $2, password_hash = $3, role_id = $4,
             status = 'active', disabled_at = NULL, purge_after = NULL, purged_at = NULL,
             session_version = session_version + 1, updated_at = now()
         WHERE id = $5
         RETURNING password_hash`,
        [admin.fullName, admin.username, passwordHash, roleId, existing.rows[0].id],
      );
      if (!updated.rows[0] || !(await verifyPassword(admin.password, updated.rows[0].password_hash))) {
        throw new Error("Admin password verification failed after reset.");
      }
      await client.query(
        "INSERT INTO user_lifecycle_events(user_id, event_type, details) VALUES ($1, 'password_reset_by_admin', $2::jsonb)",
        [existing.rows[0].id, JSON.stringify({ by: "seed-admin" })],
      );
      return "updated" as const;
    }

    const created = await client.query<{ id: string; password_hash: string }>(
      `INSERT INTO users(full_name, username, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, password_hash`,
      [admin.fullName, admin.username, admin.email, passwordHash, roleId],
    );
    const user = created.rows[0];
    if (!user || !(await verifyPassword(admin.password, user.password_hash))) {
      throw new Error("Admin password verification failed after creation.");
    }
    await client.query(
      "INSERT INTO user_lifecycle_events(user_id, event_type, details) VALUES ($1, 'created', $2::jsonb)",
      [user.id, JSON.stringify({ role: "admin", by: "seed-admin" })],
    );
    return "created" as const;
  });

  await clearLoginFailuresForIdentity(admin.email);
  console.log(`Admin account ${result === "created" ? "created" : "reset"}: ${admin.email}`);
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
