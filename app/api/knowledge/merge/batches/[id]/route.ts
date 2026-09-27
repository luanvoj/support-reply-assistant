import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { query } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("knowledge:read");
  const { id } = await params;
  const batch = await query("SELECT id,status,scope,total_articles,scanned_articles,proposed_groups,completed_groups,error_code,error_message,created_at,started_at,completed_at FROM knowledge_merge_batches WHERE id=$1", [id]);
  if (!batch.rows[0]) return NextResponse.json({ error: "Không tìm thấy đợt gộp." }, { status: 404 });
  const items = await query("SELECT bi.id,bi.status,bi.article_ids,bi.score,bi.reason,bi.merge_run_id,bi.decision,bi.analysis,bi.error_code,bi.error_message,mr.status AS merge_status FROM knowledge_merge_batch_items bi LEFT JOIN knowledge_merge_runs mr ON mr.id=bi.merge_run_id WHERE bi.batch_id=$1 ORDER BY bi.score DESC NULLS LAST", [id]);
  const errors = await query<{ item_id: string | null; code: string; user_message: string; created_at: string }>("SELECT item_id,code,user_message,created_at FROM knowledge_merge_errors WHERE batch_id=$1 ORDER BY created_at DESC", [id]);
  const errorsByItem = new Map<string, Array<{ code: string; user_message: string; created_at: string }>>();
  for (const error of errors.rows) {
    if (!error.item_id) continue;
    const current = errorsByItem.get(error.item_id) ?? [];
    current.push({ code: error.code, user_message: error.user_message, created_at: error.created_at });
    errorsByItem.set(error.item_id, current);
  }
  return NextResponse.json({ batch: batch.rows[0], items: items.rows.map((item) => ({ ...item, errors: errorsByItem.get(String(item.id)) ?? [] })) });
}
