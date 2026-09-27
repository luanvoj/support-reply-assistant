import { z } from "zod";

import { chunkMarkdown } from "@/lib/retrieval/chunker";
import type { PoolClient } from "pg";

export const articleSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  contentMarkdown: z.string().trim().min(20).max(30000),
  summary: z.string().trim().max(300).optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  isVerified: z.boolean().optional(),
  effectiveUntil: z.string().datetime().nullable().optional(),
  reviewDueAt: z.string().datetime().nullable().optional(),
  sourcePriority: z.number().int().min(0).max(100).optional(),
  serviceGroup: z.string().trim().max(80).nullable().optional(),
  responsePolicy: z.enum(["grounded", "partial", "escalate"]).default("grounded"),
});

export function containsUnsupportedMedia(content: string) {
  return /<img\b|!\[[^\]]*\]\(|data:image\/|<iframe\b|<video\b/i.test(content);
}

export async function replaceArticleChunks(
  client: PoolClient,
  articleId: string,
  title: string,
  content: string,
) {
  await client.query("DELETE FROM knowledge_chunks WHERE article_id = $1", [articleId]);
  for (const chunk of chunkMarkdown(content)) {
    await client.query(
      "INSERT INTO knowledge_chunks (article_id, chunk_index, content, search_text, context_hint, token_count) VALUES ($1,$2,$3,$4,$5,$6)",
      [articleId, chunk.index, chunk.content, `${title} ${chunk.content}`, chunk.contextHint, chunk.tokenCount],
    );
  }
}
