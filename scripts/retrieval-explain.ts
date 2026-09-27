import { db, query } from "@/lib/db";

async function main() {
  await query("SET enable_seqscan = off");
  const result = await query<{ "QUERY PLAN": string }>(
    `EXPLAIN (FORMAT TEXT) SELECT c.id FROM knowledge_chunks c JOIN knowledge_articles a ON a.id=c.article_id
     WHERE a.status='published' AND a.is_verified=true AND a.replaced_at IS NULL
       AND a.effective_from <= now() AND (a.effective_until IS NULL OR a.effective_until >= now())
       AND to_tsvector('simple', c.search_text) @@ websearch_to_tsquery('simple', 'DNS CNAME') LIMIT 10`,
  );
  console.log(result.rows.map((row) => row["QUERY PLAN"]).join("\n"));
  await db.end();
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
