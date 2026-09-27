import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";
import { articleSchema, containsUnsupportedMedia, replaceArticleChunks } from "@/lib/knowledge/article";

const idSchema = z.string().uuid();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("knowledge:read");
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "ID bài viết không hợp lệ." }, { status: 400 });
  const result = await query("SELECT * FROM knowledge_articles WHERE id = $1", [id]);
  return result.rows[0] ? NextResponse.json({ article: result.rows[0] }) : NextResponse.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("knowledge:write");
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "ID bài viết không hợp lệ." }, { status: 400 });
  const parsed = articleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || containsUnsupportedMedia(parsed.data?.contentMarkdown ?? "")) return NextResponse.json({ error: "Nội dung bài viết không hợp lệ; kho chỉ nhận văn bản." }, { status: 400 });
  const article = parsed.data;
  const result = await withTransaction(async (client) => {
    const updated = await client.query<{ id: string; version: number }>(
      `UPDATE knowledge_articles SET title=$2, slug=$3, content_markdown=$4, summary=$5, status=$6::article_status, is_verified=$7, effective_until=$8, review_due_at=$9, source_priority=$10, service_group=$11, response_policy=$12, version=version+1, reviewed_by=CASE WHEN $6::text='published' THEN $13 ELSE reviewed_by END, published_at=CASE WHEN $6::text='published' THEN now() ELSE published_at END, updated_at=now() WHERE id=$1 RETURNING id, version`,
      [id, article.title, article.slug, article.contentMarkdown, article.summary ?? null, article.status, article.isVerified ?? article.status === "published", article.effectiveUntil ?? null, article.reviewDueAt ?? null, article.sourcePriority ?? 0, article.serviceGroup ?? null, article.responsePolicy, session.userId],
    );
    if (!updated.rows[0]) return null;
    await replaceArticleChunks(client, id, article.title, article.contentMarkdown);
    await client.query("INSERT INTO knowledge_article_audits (article_id, actor_id, action, version) VALUES ($1,$2,'updated',$3)", [id, session.userId, updated.rows[0].version]);
    return updated.rows[0];
  });
  return result ? NextResponse.json({ article: result }) : NextResponse.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("knowledge:write");
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "ID bài viết không hợp lệ." }, { status: 400 });
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";
  if (!permanent) {
    const archived = await query("UPDATE knowledge_articles SET status='archived', updated_at=now() WHERE id=$1 RETURNING id", [id]);
    if (archived.rows[0]) await query("INSERT INTO knowledge_article_audits (article_id, actor_id, action, version) VALUES ($1,$2,'archived',(SELECT version FROM knowledge_articles WHERE id=$1))", [id, session.userId]);
    return archived.rows[0] ? NextResponse.json({ status: "archived" }) : NextResponse.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
  }
  const cited = await query<{ id: string }>("SELECT id FROM messages WHERE retrieval_summary @> jsonb_build_array(jsonb_build_object('articleId',$1::text)) LIMIT 1", [id]);
  if (cited.rows[0]) return NextResponse.json({ error: "Bài viết đã được trích dẫn; hãy lưu trữ để bảo toàn lịch sử." }, { status: 409 });
  const deleted = await query("DELETE FROM knowledge_articles WHERE id=$1 RETURNING id", [id]);
  return deleted.rows[0] ? NextResponse.json({ status: "deleted" }) : NextResponse.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
}
