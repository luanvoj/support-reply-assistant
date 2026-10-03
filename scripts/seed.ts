import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error("SEED_PASSWORD must be set before creating demo users.");
  }
  const passwordHash = await hashPassword(password);
  const users = [
    ["Demo Sales", "sales@example.local", "sales"],
    ["Demo Technical", "technical@example.local", "technical"],
    ["Demo Admin", "admin@example.local", "admin"],
  ] as const;

  for (const [fullName, email, role] of users) {
    await db.query(
      `INSERT INTO users (full_name, username, email, password_hash, role_id)
       SELECT $1, split_part($2, '@', 1), $2, $3, id FROM roles WHERE code = $4
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id`,
      [fullName, email, passwordHash, role],
    );
  }

  await db.end();
  console.log("Seeded demo users: sales@example.local, technical@example.local, admin@example.local");
}

void main();
