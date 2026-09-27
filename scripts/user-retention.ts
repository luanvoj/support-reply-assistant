import { db, query, withTransaction } from "@/lib/db";
import { removeUserAvatar } from "@/lib/storage/user-avatar";

const apply = process.argv.includes("--apply");

type Candidate = { id: string; avatar_key: string | null };

async function main() {
  const candidates = await query<Candidate>(
    `SELECT id, avatar_key FROM users
     WHERE status = 'disabled' AND purge_after IS NOT NULL AND purge_after <= now()
     ORDER BY purge_after ASC`,
  );
  if (!apply) {
    console.log(`Dry run: ${candidates.rows.length} tài khoản đủ điều kiện làm sạch. Chạy với --apply để thực hiện.`);
    return;
  }
  let purged = 0;
  for (const candidate of candidates.rows) {
    const didPurge = await withTransaction(async (client) => {
      const openTickets = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM unanswered_questions
         WHERE (assigned_to = $1 OR created_by = $1) AND status IN ('new', 'in_review')`, [candidate.id],
      );
      if (Number(openTickets.rows[0]?.count ?? 0) > 0) return false;
      await client.query("DELETE FROM user_mfa_totp WHERE user_id = $1", [candidate.id]);
      await client.query(
        `UPDATE users SET status = 'purged', full_name = 'Tài khoản đã xóa',
          email = 'deleted-' || replace(id::text, '-', '') || '@invalid.local',
          username = 'deleted-' || replace(id::text, '-', ''),
          password_hash = '', avatar_key = NULL, avatar_content_type = NULL, avatar_size_bytes = NULL,
          mfa_enabled_at = NULL, session_version = session_version + 1, purged_at = now(), updated_at = now()
         WHERE id = $1 AND status = 'disabled'`, [candidate.id],
      );
      await client.query("INSERT INTO user_lifecycle_events(user_id, event_type, details) VALUES ($1, 'purged', $2::jsonb)", [candidate.id, JSON.stringify({ avatarRemoved: Boolean(candidate.avatar_key) })]);
      return true;
    });
    if (didPurge) { await removeUserAvatar(candidate.id); purged += 1; }
  }
  console.log(`Đã làm sạch ${purged}/${candidates.rows.length} tài khoản đủ điều kiện.`);
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.end());
