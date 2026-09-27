import { query, withTransaction } from "@/lib/db";
import { createProvider, providerConfigFromRow } from "@/lib/ai/providers";
import { providerAvailableForOptionalWork } from "@/lib/ai/provider-resilience";
import { rerankWithProvider } from "@/lib/retrieval/llm-rerank";
import { mergeCandidates } from "@/lib/knowledge/merge-retrieval";

type Article = { id: string; title: string; summary: string | null; content_markdown: string; version: number; service_group: string | null; response_policy: "grounded" | "escalate" };
type Scope = { limit: number; threshold: number; prefilterThreshold?: number; synonyms?: string[]; serviceGroup?: string; verifiedOnly: boolean };
const pair = (a: string, b: string) => a < b ? [a, b] as const : [b, a] as const;

async function failBatch(batchId: string, code: string) {
  const message = code === "MERGE_PROVIDER_NOT_CONFIGURED" ? "Chưa có Agent đang bật để quét gộp bài." : code === "MERGE_PROVIDER_UNAVAILABLE" ? "Agent đang tạm nghỉ. Hãy thử lại sau khi kết nối được khôi phục." : "Không thể hoàn tất quét gộp. Hãy thử lại.";
  await withTransaction(async (client) => {
    await client.query("UPDATE knowledge_merge_batches SET status='failed',error_code=$2,error_message=$3,completed_at=now() WHERE id=$1", [batchId, code, message]);
    await client.query("INSERT INTO knowledge_merge_errors(batch_id,code,user_message,technical_context) VALUES($1,$2,$3,$4)", [batchId, code, "Đợt gộp không hoàn tất. Hãy thử lại hoặc liên hệ quản trị viên.", JSON.stringify({ step: "scan" })]);
  });
}

export async function scanMergeBatch(batchId: string) {
  const batch = await query<{ scope: Scope; status: string }>("SELECT scope,status FROM knowledge_merge_batches WHERE id=$1", [batchId]);
  if (!batch.rows[0] || batch.rows[0].status !== "queued") throw new Error("MERGE_BATCH_NOT_READY");
  const providerRows = await query<Record<string, unknown>>("SELECT * FROM ai_provider_settings WHERE is_enabled=true ORDER BY is_default DESC LIMIT 1");
  const providerRow = providerRows.rows[0];
  const unavailableCode = !providerRow ? "MERGE_PROVIDER_NOT_CONFIGURED" : !await providerAvailableForOptionalWork(providerRow) ? "MERGE_PROVIDER_UNAVAILABLE" : null;
  if (unavailableCode) { await failBatch(batchId, unavailableCode); throw new Error(unavailableCode); }
  const provider = createProvider(providerConfigFromRow(providerRow));
  const scope = batch.rows[0].scope;
  await query("UPDATE knowledge_merge_batches SET status='scanning',started_at=now() WHERE id=$1 AND status='queued'", [batchId]);
  try {
    const articles = await query<Article>("SELECT id,title,summary,content_markdown,version,service_group,response_policy FROM knowledge_articles WHERE status='published' AND ($1::boolean=false OR is_verified=true) AND ($2::text IS NULL OR service_group=$2) ORDER BY updated_at DESC LIMIT $3", [scope.verifiedOnly, scope.serviceGroup ?? null, scope.limit]);
    const seen = new Set<string>(); let groups = 0; let skipped = 0;
    for (let index = 0; index < articles.rows.length; index += 1) {
      const source = articles.rows[index];
      const raw = await mergeCandidates({ id: source.id, title: source.title, summary: source.summary, content: source.content_markdown, serviceGroup: source.service_group, policy: source.response_policy }, 10, scope.synonyms);
      const allowed = [] as Array<{ id: string; articleId: string; sourceTitle: string; content: string; keywordScore: number; score: number; responsePolicy: "grounded" | "escalate"; version: number }>;
      for (const item of raw) {
        const [low, high] = pair(source.id, item.id); const key = `${low}:${high}`;
        if (seen.has(key)) continue; seen.add(key);
        const prior = await query("SELECT id FROM knowledge_merge_pair_decisions WHERE article_low_id=$1 AND article_high_id=$2 AND low_version=$3 AND high_version=$4 AND decision='not_merge' LIMIT 1", [low, high, low === source.id ? source.version : item.version, high === source.id ? source.version : item.version]);
        if (prior.rows[0]) { skipped += 1; continue; }
        if (item.score >= (scope.prefilterThreshold ?? .4)) allowed.push({ id: item.id, articleId: item.id, sourceTitle: item.title, content: item.content_markdown, keywordScore: item.score, score: item.score, responsePolicy: source.response_policy, version: item.version });
      }
      const ranked = await rerankWithProvider(provider, `Đánh giá bài nào trùng nội dung với: ${source.title}`, allowed, .45);
      if (ranked.reason === "provider_unavailable") throw new Error("MERGE_PROVIDER_UNAVAILABLE");
      if (ranked.reason === "no_match") { await query("UPDATE knowledge_merge_batches SET scanned_articles=$2,proposed_groups=$3 WHERE id=$1", [batchId, index + 1, groups]); continue; }
      for (const selected of ranked.sources.filter((item) => item.score >= scope.threshold).slice(0, 2)) {
        await query("INSERT INTO knowledge_merge_batch_items(batch_id,status,article_ids,score,reason) VALUES($1,'candidate',$2,$3,$4)", [batchId, JSON.stringify([source.id, selected.articleId]), selected.score, `Cùng nhóm ${source.service_group ?? "chưa phân loại"}, cùng chính sách ${source.response_policy}; Agent rerank xác nhận nội dung gần nhau.`]);
        groups += 1;
      }
      await query("UPDATE knowledge_merge_batches SET scanned_articles=$2,proposed_groups=$3 WHERE id=$1", [batchId, index + 1, groups]);
    }
    await query("UPDATE knowledge_merge_batches SET status='review_ready',completed_at=now(),scope=scope || jsonb_build_object('skippedPreviouslyDecidedPairs',$2::integer) WHERE id=$1", [batchId, skipped]);
    return { scanned: articles.rows.length, groups, skipped };
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("MERGE_") ? error.message : "MERGE_SCAN_FAILED";
    await failBatch(batchId, code);
    throw error;
  }
}
