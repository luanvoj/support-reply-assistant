import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";
import { articleSchema, containsUnsupportedMedia, replaceArticleChunks } from "@/lib/knowledge/article";
import { getUserLogSnapshot, writeOperationalLog } from "@/lib/operational-log";

const idSchema = z.string().uuid();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("knowledge:read");
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "ID bài viết không hợp lệ." }, { status: 400 });
  const result = await query("SELECT a.*, CASE WHEN a.response_policy = 'grounded' THEN 'grounded' ELSE 'escalate' END AS response_policy FROM knowledge_articles a WHERE id = $1", [id]);
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
  const confirmation = await request.json().catch(() => null);
  if (confirmation?.confirm !== true) return NextResponse.json({ error: "Cần xác nhận xóa vĩnh viễn bài viết." }, { status: 400 });
  try {
    const result = await withTransaction(async (client) => {
      const article = await client.query<{ id: string; title: string; status: string }>(
        "SELECT id,title,status FROM knowledge_articles WHERE id=$1 FOR UPDATE", [id],
      );
      const target = article.rows[0];
      if (!target) return "missing";
      if (target.status !== "archived") return "not_archived";

      // Remove references in the same transaction. No linked history may veto a confirmed purge.
      await client.query("UPDATE question_reviews SET published_article_id=NULL,draft_answer=NULL,final_answer=NULL,updated_at=now() WHERE published_article_id=$1", [id]);
      await client.query("UPDATE knowledge_import_rows SET article_id=NULL,payload='{}'::jsonb WHERE article_id=$1", [id]);
      await client.query("UPDATE knowledge_articles SET replaced_by=NULL,replaced_at=NULL WHERE replaced_by=$1", [id]);
      await client.query("DELETE FROM knowledge_merge_errors WHERE item_id IN (SELECT id FROM knowledge_merge_batch_items WHERE article_ids @> jsonb_build_array($1::text))", [id]);
      await client.query("DELETE FROM knowledge_merge_batch_items WHERE article_ids @> jsonb_build_array($1::text)", [id]);
      await client.query("DELETE FROM knowledge_merge_sources WHERE article_id=$1", [id]);
      await client.query("UPDATE knowledge_merge_batch_items SET merge_run_id=NULL WHERE merge_run_id IN (SELECT id FROM knowledge_merge_runs WHERE merged_article_id=$1)", [id]);
      await client.query("DELETE FROM knowledge_merge_runs WHERE merged_article_id=$1", [id]);
      await client.query("DELETE FROM knowledge_articles WHERE id=$1", [id]);
      const actorSnapshot = await getUserLogSnapshot(session.userId, client);
      await writeOperationalLog({
        category: "knowledge", action: "knowledge_article_hard_deleted",
        summary: `${actorSnapshot.username} đã xóa vĩnh viễn bài viết`,
        actorUserId: session.userId, actorSnapshot,
        details: { articleId: id, title: target.title },
      }, client);
      return "deleted";
    });
    if (result === "missing") return NextResponse.json({ status: "deleted" });
    if (result === "not_archived") return NextResponse.json({ error: "Hãy lưu trữ bài viết trước khi xóa vĩnh viễn." }, { status: 409 });
    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    console.error("[knowledge.article.delete]", error);
    return NextResponse.json({ error: "Không thể xóa bài viết. Vui lòng thử lại hoặc liên hệ quản trị viên." }, { status: 500 });
  }
}
