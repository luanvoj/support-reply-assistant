import { db, query } from "@/lib/db";

async function main() {
  const apply = process.argv.includes("--apply");
  const result = await query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM password_reset_requests
     WHERE (consumed_at IS NOT NULL OR expires_at < now())
       AND created_at < now() - interval '30 days'`,
  );
  if (!apply) {
    console.log(`Would remove ${result.rows[0]?.count ?? "0"} expired or consumed password-reset requests older than 30 days. Re-run with --apply.`);
    return;
  }
  const removed = await query(
    `DELETE FROM password_reset_requests
     WHERE (consumed_at IS NOT NULL OR expires_at < now())
       AND created_at < now() - interval '30 days'`,
  );
  console.log(`Removed ${removed.rowCount ?? 0} expired or consumed password-reset requests older than 30 days.`);
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.end());
