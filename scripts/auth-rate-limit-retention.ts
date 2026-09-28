import { db, query } from "@/lib/db";

async function main() {
  const apply = process.argv.includes("--apply");
  const result = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM auth_rate_limit_buckets
     WHERE updated_at < now() - interval '24 hours'
       AND (blocked_until IS NULL OR blocked_until < now())`,
  );
  if (!apply) {
    console.log(`Would remove ${result.rows[0]?.count ?? "0"} expired authentication rate-limit buckets. Re-run with --apply.`);
    return;
  }
  const removed = await query(
    `DELETE FROM auth_rate_limit_buckets
     WHERE updated_at < now() - interval '24 hours'
       AND (blocked_until IS NULL OR blocked_until < now())`,
  );
  console.log(`Removed ${removed.rowCount ?? 0} expired authentication rate-limit buckets.`);
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.end());
