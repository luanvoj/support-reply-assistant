import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";
import { articleSchema, containsUnsupportedMedia, replaceArticleChunks } from "@/lib/knowledge/article";

export async function GET(request: Request) {
  await requirePermission("knowledge:read");
  const status = new URL(request.url).searchParams.get("status");
  const params = new URL(request.url).searchParams; const page=Math.max(1,Number(params.get("page")??1)); const pageSize=Math.min(100,Math.max(10,Number(params.get("pageSize")??20)));
  const allowed = ["published", "draft", "archived"];
  const result = await query(
    `SELECT a.id, a.title, a.slug, a.status, a.summary, a.is_verified, a.version, a.effective_until, a.review_due_at, a.source_priority, a.replaced_at, a.updated_at, a.service_group, a.response_policy, a.source_file, mr.id AS merge_run_id, mr.status AS merge_status, count(kc.id)::int AS chunk_count FROM knowledge_articles a LEFT JOIN knowledge_chunks kc ON kc.article_id = a.id LEFT JOIN knowledge_merge_runs mr ON mr.merged_article_id = a.id WHERE ($1::text IS NULL OR a.status::text=$1) GROUP BY a.id,mr.id,mr.status ORDER BY a.updated_at DESC LIMIT $2 OFFSET $3`,
    [allowed.includes(status ?? "") ? status : null,pageSize,(page-1)*pageSize],
  );
  const total=await query<{count:number}>("SELECT count(*)::int count FROM knowledge_articles WHERE ($1::text IS NULL OR status::text=$1)",[allowed.includes(status ?? "") ? status : null]);
  return NextResponse.json({ articles: result.rows, pagination:{page,pageSize,total:total.rows[0].count} });
}

export async function POST(request: Request) {
  const session = await requirePermission("knowledge:write");
  const parsed = articleSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const article = parsed.data;
  if (containsUnsupportedMedia(article.contentMarkdown))
    return NextResponse.json(
      {
        error:
          "Kho kiến thức chỉ nhận văn bản. Hãy mô tả nội dung hình ảnh bằng chữ.",
      },
      { status: 400 },
    );
  const usage = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM knowledge_articles WHERE created_by = $1 AND created_at >= now() - interval '1 hour'`,
    [session.userId],
  );
  if ((usage.rows[0]?.count ?? 0) >= 10)
    return NextResponse.json(
      {
        error:
          "Bạn đã tạo tối đa 10 bài viết trong một giờ. Vui lòng thử lại sau.",
      },
      { status: 429 },
    );
  const duplicate = await query<{ id: string }>(
    `SELECT id FROM knowledge_articles WHERE created_by = $1 AND lower(title) = lower($2) AND created_at >= now() - interval '5 minutes' LIMIT 1`,
    [session.userId, article.title],
  );
  if (duplicate.rows[0])
    return NextResponse.json(
      {
        error:
          "Bài viết có cùng tiêu đề vừa được tạo. Hãy kiểm tra lại danh sách nguồn.",
      },
      { status: 409 },
    );
  const result = await withTransaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO knowledge_articles (title, slug, content_markdown, summary, status, is_verified, effective_until, review_due_at, source_priority, service_group, response_policy, created_by, reviewed_by, published_at)
       VALUES ($1,$2,$3,$4,$5::article_status,$6,$7,$8,$9,$10,$11,$12,$13,CASE WHEN $5::text = 'published' THEN now() ELSE NULL END) RETURNING id`,
      [
        article.title,
        article.slug,
        article.contentMarkdown,
        article.summary ?? null,
        article.status,
        article.isVerified ?? article.status === "published",
        article.effectiveUntil ?? null,
        article.reviewDueAt ?? null,
        article.sourcePriority ?? 0,
        article.serviceGroup ?? null,
        article.responsePolicy,
        session.userId,
        article.status === "published" ? session.userId : null,
      ],
    );
    await replaceArticleChunks(client, inserted.rows[0].id, article.title, article.contentMarkdown);
    await client.query("INSERT INTO knowledge_article_audits (article_id, actor_id, action, version) VALUES ($1,$2,'created',1)", [inserted.rows[0].id, session.userId]);
    return { id: inserted.rows[0].id };
  });
  return NextResponse.json({ article: result }, { status: 201 });
}
