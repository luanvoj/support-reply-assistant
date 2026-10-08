import { db } from "@/lib/db";
import { searchPublishedChunks } from "@/lib/retrieval/search";
import { defaultRetrievalSettings } from "@/lib/retrieval/settings";

const expectedUsers = ["sales@example.local", "technical@example.local", "admin@example.local"] as const;
const expectedArticleKeys = ["demo:competition:refund-policy", "demo:competition:refund-evidence"] as const;

async function main() {
  const users = await db.query<{ email: string; role: string }>(
    `SELECT u.email, r.code AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.email = ANY($1::text[])`,
    [expectedUsers],
  );
  if (users.rows.length !== expectedUsers.length) {
    throw new Error("Demo users are incomplete. Run npm run db:seed with SEED_PASSWORD set.");
  }

  const articles = await db.query<{ source_key: string; is_verified: boolean; status: string; chunk_count: string }>(
    `SELECT a.source_key, a.is_verified, a.status, count(c.id)::text AS chunk_count
     FROM knowledge_articles a
     LEFT JOIN knowledge_chunks c ON c.article_id = a.id
     WHERE a.source_key = ANY($1::text[])
     GROUP BY a.id`,
    [expectedArticleKeys],
  );
  if (
    articles.rows.length !== expectedArticleKeys.length ||
    articles.rows.some((article) => article.status !== "published" || !article.is_verified || Number(article.chunk_count) < 1)
  ) {
    throw new Error("Demo knowledge fixtures are incomplete, unpublished, or not indexed. Run npm run db:seed again.");
  }

  const sources = await searchPublishedChunks("điều kiện hoàn tiền dịch vụ", defaultRetrievalSettings);
  if (!sources.some((source) => source.sourceTitle === "[DEMO] Điều kiện hoàn tiền dịch vụ")) {
    throw new Error("Demo grounded question did not retrieve its verified source.");
  }

  console.log("demo fixture smoke passed: roles, verified knowledge, and grounded retrieval");
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
