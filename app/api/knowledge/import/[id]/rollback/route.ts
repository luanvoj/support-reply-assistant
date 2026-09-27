import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("knowledge:write"); const { id } = await params;
  try {
    const result = await withTransaction(async (client) => {
      const batch = await client.query("SELECT id,status FROM knowledge_import_batches WHERE id=$1 FOR UPDATE", [id]);
      if (!batch.rows[0] || batch.rows[0].status !== "imported") throw new Error("Batch import không còn có thể hoàn tác.");
      const citations = await client.query("SELECT count(*)::int AS count FROM knowledge_import_rows r JOIN retrieval_logs l ON l.top_chunks_json @> jsonb_build_object('sources', jsonb_build_array(jsonb_build_object('articleId', r.article_id::text))) WHERE r.batch_id=$1", [id]);
      if (Number(citations.rows[0]?.count ?? 0) > 0) throw new Error("Không thể hoàn tác vì bài import đã được dùng làm căn cứ trả lời. Hãy lưu trữ từng bài để giữ lịch sử.");
      const articleIds = await client.query<{ article_id: string }>("SELECT article_id FROM knowledge_import_rows WHERE batch_id=$1 AND article_id IS NOT NULL FOR UPDATE", [id]);
      await client.query("UPDATE knowledge_import_rows SET status='rolled_back',article_id=NULL WHERE batch_id=$1", [id]);
      const removed = await client.query("DELETE FROM knowledge_articles WHERE id=ANY($1::uuid[]) RETURNING id", [articleIds.rows.map((row) => row.article_id)]);
      await client.query("UPDATE knowledge_import_batches SET status='rolled_back',rolled_back_at=now() WHERE id=$1", [id]);
      return removed.rowCount ?? 0;
    }); return NextResponse.json({ rolledBack: result });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể hoàn tác batch." }, { status: 400 }); }
}
