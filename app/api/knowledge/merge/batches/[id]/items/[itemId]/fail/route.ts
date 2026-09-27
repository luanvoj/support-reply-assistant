import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db";

const outcomeSchema = z.object({
  code: z.enum([
    "AGENT_NOT_CONFIGURED",
    "AGENT_REQUEST_FAILED",
    "AGENT_INVALID_RESPONSE",
    "KEEP_SEPARATE",
    "NO_SUITABLE_MATCH",
    "ATTACH_FAILED",
  ]),
});

const outcomes = {
  AGENT_NOT_CONFIGURED: { status: "failed", step: "provider_configuration", message: "Chưa có Agent đang bật để tạo bản nháp gộp." },
  AGENT_REQUEST_FAILED: { status: "failed", step: "generate_draft", message: "Agent đã được cấu hình nhưng không phản hồi khi tạo bản nháp. Hãy thử lại sau." },
  AGENT_INVALID_RESPONSE: { status: "failed", step: "validate_agent_response", message: "Agent đã phản hồi nhưng kết quả tạo nháp chưa hợp lệ. Hãy thử lại." },
  KEEP_SEPARATE: { status: "skipped", step: "agent_decision", message: "Agent đánh giá hai bài nên được giữ riêng; không tạo bản nháp gộp." },
  NO_SUITABLE_MATCH: { status: "skipped", step: "find_match", message: "Chưa tìm thấy bài đủ tương đồng để tạo bản nháp gộp." },
  ATTACH_FAILED: { status: "failed", step: "attach_draft", message: "Đã tạo bản nháp nhưng chưa thể gắn vào nhóm gộp. Hãy thử lại." },
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await requirePermission("knowledge:write");
  const { id, itemId } = await params;
  const body = outcomeSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Kết quả tạo nháp không hợp lệ." }, { status: 400 });

  const outcome = outcomes[body.data.code];
  const updated = await withTransaction(async (client) => {
    const item = await client.query<{ id: string; article_ids: string[] }>(
      "UPDATE knowledge_merge_batch_items SET status=$3,error_code=$4,error_message=$5,updated_at=now() WHERE id=$2 AND batch_id=$1 RETURNING id,article_ids",
      [id, itemId, outcome.status, body.data.code, outcome.message],
    );
    if (item.rows[0] && outcome.status === "failed") {
      await client.query(
        "INSERT INTO knowledge_merge_errors(batch_id,item_id,code,user_message,technical_context) VALUES($1,$2,$3,$4,$5)",
        [id, itemId, body.data.code, outcome.message, JSON.stringify({ step: outcome.step })],
      );
    }
    if (item.rows[0] && body.data.code === "KEEP_SEPARATE") {
      const ids = item.rows[0].article_ids;
      const articles = await client.query<{ id: string; version: number }>("SELECT id,version FROM knowledge_articles WHERE id = ANY($1::uuid[])", [ids]);
      if (articles.rows.length === 2) {
        const [first, second] = articles.rows.sort((a, b) => a.id.localeCompare(b.id));
        await client.query("INSERT INTO knowledge_merge_pair_decisions(article_low_id,article_high_id,low_version,high_version,decision,reason,decided_by) VALUES($1,$2,$3,$4,'not_merge',$5,$6) ON CONFLICT(article_low_id,article_high_id,low_version,high_version,decision) DO UPDATE SET reason=EXCLUDED.reason,decided_by=EXCLUDED.decided_by,created_at=now()", [first.id, second.id, first.version, second.version, outcome.message, session.userId]);
      }
    }
    return item.rows[0];
  });
  return updated
    ? NextResponse.json({ status: outcome.status, code: body.data.code, message: outcome.message })
    : NextResponse.json({ error: "Không tìm thấy nhóm gộp." }, { status: 404 });
}
