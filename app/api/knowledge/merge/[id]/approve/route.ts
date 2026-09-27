import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("knowledge:write"); const { id } = await params;
  try {
    await withTransaction(async (client) => {
      const run = await client.query<{ merged_article_id:string }>("SELECT merged_article_id FROM knowledge_merge_runs WHERE id=$1 AND status='draft' FOR UPDATE", [id]);
      if (!run.rows[0]) throw new Error("Đề xuất gộp không còn chờ duyệt."); const articleId=run.rows[0].merged_article_id;
      const sources = await client.query<{article_id:string}>("SELECT article_id FROM knowledge_merge_sources WHERE merge_run_id=$1",[id]);
      await client.query("UPDATE knowledge_articles SET status='published',is_verified=true,reviewed_by=$2,published_at=now(),updated_at=now() WHERE id=$1",[articleId,session.userId]);
      await client.query("UPDATE knowledge_articles SET status='archived',replaced_at=now(),replaced_by=$2,updated_at=now() WHERE id=ANY($1::uuid[])",[sources.rows.map(row=>row.article_id),articleId]);
      await client.query("UPDATE knowledge_merge_runs SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1",[id,session.userId]);
      await client.query(
        "UPDATE knowledge_merge_batch_items SET status='drafted',merge_run_id=$2,error_code=NULL,error_message=NULL,updated_at=now() WHERE status IN ('candidate','selected','generating','failed') AND article_ids @> $1::jsonb AND article_ids <@ $1::jsonb",
        [JSON.stringify(sources.rows.map(row=>row.article_id)), id],
      );
      await client.query("INSERT INTO knowledge_article_audits (article_id,actor_id,action,version,details) VALUES ($1,$2,'merge_published',1,$3)",[articleId,session.userId,JSON.stringify({mergeRunId:id,sources:sources.rows.map(row=>row.article_id)})]);
    }); return NextResponse.json({ status:"approved" });
  } catch (error) { return NextResponse.json({ error:error instanceof Error?error.message:"Không thể duyệt bản gộp." },{status:400}); }
}
