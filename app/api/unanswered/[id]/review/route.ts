import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";
import { chunkMarkdown } from "@/lib/retrieval/chunker";

const reviewSchema = z.object({
  draftAnswer: z.string().min(20),
  finalAnswer: z.string().min(20),
  publish: z.boolean().default(false),
  title: z.string().min(3).max(200).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  categoryId: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission("knowledge:write");
  const { id } = await context.params;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const input = parsed.data;

  const result = await withTransaction(async (client) => {
    const question = await client.query<{
      original_question: string;
      conversation_id: string;
    }>(
      "SELECT original_question, conversation_id FROM unanswered_questions WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!question.rows[0]) throw new Error("Unanswered question not found");
    const review = await client.query<{ id: string }>(
      `INSERT INTO question_reviews (unanswered_question_id, reviewer_id, draft_answer, final_answer, status)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING RETURNING id`,
      [
        id,
        session.userId,
        input.publish ? null : input.draftAnswer,
        input.publish ? null : input.finalAnswer,
        input.publish ? "published" : "approved",
      ],
    );
    let articleId: string | null = null;
    if (input.publish) {
      if (!input.title || !input.slug)
        throw new Error("title and slug are required when publishing");
      const article = await client.query<{ id: string }>(
        `INSERT INTO knowledge_articles (title, slug, category_id, status, is_verified, content_markdown, summary, created_by, reviewed_by, published_at)
         VALUES ($1,$2,$3,'published',true,$4,$5,$6,$6,now()) RETURNING id`,
        [
          input.title,
          input.slug,
          input.categoryId ?? null,
          input.finalAnswer,
          input.finalAnswer.slice(0, 240),
          session.userId,
        ],
      );
      articleId = article.rows[0].id;
      for (const chunk of chunkMarkdown(input.finalAnswer)) {
        await client.query(
        "INSERT INTO knowledge_chunks (article_id, chunk_index, content, search_text, context_hint, token_count) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            articleId,
            chunk.index,
          chunk.content,
          `${input.title} ${chunk.content}`,
          chunk.contextHint,
            chunk.tokenCount,
          ],
        );
      }
      await client.query(
        "UPDATE question_reviews SET published_article_id = $1 WHERE id = $2",
        [articleId, review.rows[0]?.id ?? null],
      );
      await client.query(
        "UPDATE unanswered_questions SET status = 'published', updated_at = now() WHERE id = $1",
        [id],
      );
      await client.query(
        "UPDATE conversations SET classification = 'knowledge_linked', updated_at = now() WHERE id = $1",
        [question.rows[0].conversation_id],
      );
    } else {
      await client.query(
        "UPDATE unanswered_questions SET status = 'answered', updated_at = now() WHERE id = $1",
        [id],
      );
    }
    return { reviewId: review.rows[0]?.id ?? null, articleId };
  });
  return NextResponse.json(result, { status: 201 });
}
