import { query } from "@/lib/db";
import { hybridRank, type RetrievalCandidate } from "@/lib/retrieval/ranking";
import type { RetrievalSettings } from "@/lib/retrieval/settings";

const vietnameseQueryStopWords = new Set([
  "a", "à", "ạ", "ai", "bạn", "cái", "cho", "có", "còn", "của", "đã",
  "đây", "đó", "gì", "giúp", "hả", "hay", "không", "là", "mình", "nào",
  "này", "nhé", "nha", "nó", "sao", "thế", "tôi", "vậy", "về", "với",
]);

/** Removes conversational filler before lexical search without changing the user-facing question. */
export function normalizeRetrievalQuery(value: string) {
  const terms = value
    .toLocaleLowerCase("vi-VN")
    .match(/[\p{L}\p{N}]{2,}/gu)
    ?.filter((term) => !vietnameseQueryStopWords.has(term)) ?? [];
  return [...new Set(terms)].join(" ");
}

function toPrefixOrQuery(value: string) {
  return normalizeRetrievalQuery(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(" | ");
}

type SearchRow = {
  id: string;
  article_id: string;
  content: string;
  title: string;
  lexical_score: number;
  response_policy?: "grounded" | "escalate";
};

function mapRows(rows: SearchRow[]) {
  const highestScore = rows[0]?.lexical_score ?? 0;
  return rows.map(
    (row): RetrievalCandidate => ({
      id: row.id,
      articleId: row.article_id,
      content: row.content,
      sourceTitle: row.title,
      keywordScore:
        highestScore > 0 ? Math.min(1, row.lexical_score / highestScore) : 0,
      responsePolicy: row.response_policy === "grounded" ? "grounded" : "escalate",
    }),
  );
}

export async function searchPublishedChunks(
  question: string,
  settings?: RetrievalSettings,
) {
  const normalizedQuestion = normalizeRetrievalQuery(question);
  if (!normalizedQuestion) return [];
  const limit = Math.max((settings?.topK ?? 10) * 8, 40);
  const rows = await query<SearchRow>(
    `WITH query_terms AS (
       SELECT websearch_to_tsquery('simple', $1) AS value
     )
     SELECT c.id, c.article_id, c.content, a.title, a.response_policy,
       ts_rank_cd(
         to_tsvector('simple', c.search_text),
         query_terms.value,
         32
       )::float AS lexical_score
     FROM knowledge_chunks c
     JOIN knowledge_articles a ON a.id = c.article_id
     CROSS JOIN query_terms
     WHERE a.status = 'published'
       AND ($2::boolean = false OR a.is_verified = true)
       AND ($3::boolean = false OR a.replaced_at IS NULL)
       AND a.effective_from <= now()
       AND (a.effective_until IS NULL OR a.effective_until >= now())
       AND to_tsvector('simple', c.search_text) @@ query_terms.value
     ORDER BY lexical_score DESC, a.source_priority DESC, a.updated_at DESC
     LIMIT $4`,
    [
      normalizedQuestion,
      settings?.verifiedOnly ?? true,
      settings?.excludeReplaced ?? true,
      limit,
    ],
  );
  let candidates = mapRows(rows.rows);
  // `simple` does not stem English terms, so “record” cannot match “records”.
  // A prefix-OR fallback keeps recall for short conversational questions while
  // the normal all-terms query remains the preferred, precise path.
  if (!candidates.length) {
    const prefixQuery = toPrefixOrQuery(question);
    if (prefixQuery) {
      const fallback = await query<SearchRow>(
        `WITH query_terms AS (
           SELECT to_tsquery('simple', $1) AS value
         )
         SELECT c.id, c.article_id, c.content, a.title, a.response_policy,
           ts_rank_cd(to_tsvector('simple', c.search_text), query_terms.value, 32)::float AS lexical_score
         FROM knowledge_chunks c
         JOIN knowledge_articles a ON a.id = c.article_id
         CROSS JOIN query_terms
         WHERE a.status = 'published'
           AND ($2::boolean = false OR a.is_verified = true)
           AND ($3::boolean = false OR a.replaced_at IS NULL)
           AND a.effective_from <= now()
           AND (a.effective_until IS NULL OR a.effective_until >= now())
           AND to_tsvector('simple', c.search_text) @@ query_terms.value
         ORDER BY lexical_score DESC, a.source_priority DESC, a.updated_at DESC
         LIMIT $4`,
        [
          prefixQuery,
          settings?.verifiedOnly ?? true,
          settings?.excludeReplaced ?? true,
          limit,
        ],
      );
      candidates = mapRows(fallback.rows);
    }
  }
  return hybridRank(
    candidates,
    settings?.topK ?? 10,
    settings?.keywordWeight ?? 0.4,
    settings?.semanticWeight ?? 0.6,
    settings?.maxArticles ?? 3,
    settings?.diversityWeight ?? 0.3,
  );
}

/** Loads cited chunks from the immediately preceding grounded answer. */
export async function loadPublishedChunksByIds(
  ids: string[],
  settings?: RetrievalSettings,
) {
  const uniqueIds = [...new Set(ids)].filter(
    (id) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id),
  );
  if (!uniqueIds.length) return [];
  const rows = await query<Omit<SearchRow, "lexical_score">>(
    `SELECT c.id, c.article_id, c.content, a.title, a.response_policy
     FROM knowledge_chunks c
     JOIN knowledge_articles a ON a.id = c.article_id
     WHERE c.id = ANY($1::uuid[])
       AND a.status = 'published'
       AND ($2::boolean = false OR a.is_verified = true)
       AND ($3::boolean = false OR a.replaced_at IS NULL)
       AND a.effective_from <= now()
       AND (a.effective_until IS NULL OR a.effective_until >= now())`,
    [
      uniqueIds,
      settings?.verifiedOnly ?? true,
      settings?.excludeReplaced ?? true,
    ],
  );
  const candidates = rows.rows.map(
    (row): RetrievalCandidate => ({
      id: row.id,
      articleId: row.article_id,
      content: row.content,
      sourceTitle: row.title,
      keywordScore: 0.9,
      responsePolicy: row.response_policy === "grounded" ? "grounded" : "escalate",
    }),
  );
  return hybridRank(
    candidates,
    settings?.topK ?? 10,
    settings?.keywordWeight ?? 0.4,
    settings?.semanticWeight ?? 0.6,
    settings?.maxArticles ?? 3,
    settings?.diversityWeight ?? 0.3,
  );
}
