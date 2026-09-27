import { db, query, withTransaction } from "@/lib/db";

const execute = process.argv.includes("--execute");

async function collectCounts() {
  const result = await query<{
    deletable: number;
    redactable: number;
    protected: number;
  }>(`
    SELECT
      count(*) FILTER (
        WHERE c.expires_at < now()
          AND c.status <> 'redacted'
          AND NOT EXISTS (SELECT 1 FROM unanswered_questions uq WHERE uq.conversation_id = c.id)
      )::int AS deletable,
      count(*) FILTER (
        WHERE c.expires_at < now()
          AND c.status <> 'redacted'
          AND EXISTS (SELECT 1 FROM unanswered_questions uq WHERE uq.conversation_id = c.id)
          AND NOT EXISTS (
            SELECT 1 FROM unanswered_questions uq
            WHERE uq.conversation_id = c.id AND uq.status IN ('new', 'in_review')
          )
      )::int AS redactable,
      count(*) FILTER (
        WHERE c.expires_at < now()
          AND EXISTS (
            SELECT 1 FROM unanswered_questions uq
            WHERE uq.conversation_id = c.id AND uq.status IN ('new', 'in_review')
          )
      )::int AS protected
    FROM conversations c
  `);
  return result.rows[0] ?? { deletable: 0, redactable: 0, protected: 0 };
}

async function main() {
  const counts = await collectCounts();
  if (!execute) {
    console.log(
      JSON.stringify({ mode: "preview", retentionDays: 90, ...counts }),
    );
    return;
  }

  const result = await withTransaction(async (client) => {
    const redactable = await client.query<{ id: string }>(`
      SELECT c.id FROM conversations c
      WHERE c.expires_at < now()
        AND c.status <> 'redacted'
        AND EXISTS (SELECT 1 FROM unanswered_questions uq WHERE uq.conversation_id = c.id)
        AND NOT EXISTS (
          SELECT 1 FROM unanswered_questions uq
          WHERE uq.conversation_id = c.id AND uq.status IN ('new', 'in_review')
        )
      FOR UPDATE
    `);
    const redactableIds = redactable.rows.map((row) => row.id);
    if (redactableIds.length) {
      await client.query(
        `UPDATE retrieval_logs rl
         SET query_text = '[Đã xóa theo chính sách lưu trữ 90 ngày]', top_chunks_json = '[]'::jsonb
         FROM messages m WHERE rl.message_id = m.id AND m.conversation_id = ANY($1::uuid[])`,
        [redactableIds],
      );
      await client.query(
        `UPDATE messages SET content = '[Đã xóa theo chính sách lưu trữ 90 ngày]',
           retrieval_summary = '[]'::jsonb, redacted_at = now()
         WHERE conversation_id = ANY($1::uuid[])`,
        [redactableIds],
      );
      await client.query(
        `UPDATE conversations SET status = 'redacted', classification = 'knowledge_linked',
           redacted_at = now(), archived_at = COALESCE(archived_at, now()), updated_at = now()
         WHERE id = ANY($1::uuid[])`,
        [redactableIds],
      );
    }

    const deletable = await client.query<{ id: string }>(`
      SELECT c.id FROM conversations c
      WHERE c.expires_at < now()
        AND c.status <> 'redacted'
        AND NOT EXISTS (SELECT 1 FROM unanswered_questions uq WHERE uq.conversation_id = c.id)
      FOR UPDATE
    `);
    const deletableIds = deletable.rows.map((row) => row.id);
    if (deletableIds.length) {
      await client.query(
        `DELETE FROM retrieval_logs rl USING messages m
         WHERE rl.message_id = m.id AND m.conversation_id = ANY($1::uuid[])`,
        [deletableIds],
      );
      await client.query(
        "DELETE FROM conversations WHERE id = ANY($1::uuid[])",
        [deletableIds],
      );
    }

    await client.query(
      `INSERT INTO conversation_retention_runs
       (cutoff_at, deleted_conversations, redacted_conversations, protected_conversations)
       VALUES (now() - interval '90 days', $1, $2, $3)`,
      [deletableIds.length, redactableIds.length, counts.protected],
    );
    return {
      deleted: deletableIds.length,
      redacted: redactableIds.length,
      protected: counts.protected,
    };
  });

  console.log(
    JSON.stringify({ mode: "execute", retentionDays: 90, ...result }),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
