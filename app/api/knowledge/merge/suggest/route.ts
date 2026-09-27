import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";
import { replaceArticleChunks } from "@/lib/knowledge/article";
import { createProvider, providerConfigFromRow } from "@/lib/ai/providers";
import { rerankWithProvider } from "@/lib/retrieval/llm-rerank";
import { getActiveRetrievalSettings } from "@/lib/retrieval/settings";

const words = (text: string) => new Set(text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{3,}/g) ?? []);
const similarity = (a: string, b: string) => { const x = words(a), y = words(b); const common = [...x].filter((item) => y.has(item)).length; return common / Math.max(1, new Set([...x, ...y]).size); };
const generatedSchema = z.object({ title: z.string().optional(), content: z.string().optional(), reason: z.string().optional(), conflicts: z.array(z.string()).optional(), decision: z.enum(["merge_full", "merge_partial", "keep_separate"]), sharedTopics: z.array(z.string()).optional(), uniqueTopics: z.object({ articleA: z.array(z.string()).optional(), articleB: z.array(z.string()).optional() }).optional(), uniqueCoverage: z.number().optional() });

export async function POST(request: Request) {
  const session = await requirePermission("knowledge:write");
  const { articleId } = await request.json().catch(() => ({}));
  if (!articleId) return NextResponse.json({ error: "Thiếu bài viết cần phân tích." }, { status: 400 });
  const source = await query<{ id: string; title: string; content_markdown: string; response_policy: string; service_group: string | null }>("SELECT id,title,content_markdown,response_policy,service_group FROM knowledge_articles WHERE id=$1 AND status='published'", [articleId]);
  if (!source.rows[0]) return NextResponse.json({ error: "Bài viết phải đang xuất bản." }, { status: 404 });
  const first = source.rows[0];
  const settings = await getActiveRetrievalSettings();
  const providerRow = await query<Record<string, unknown>>("SELECT * FROM ai_provider_settings WHERE is_enabled=true ORDER BY is_default DESC,updated_at DESC LIMIT 1");
  if (!providerRow.rows[0]) return NextResponse.json({ code: "AGENT_NOT_CONFIGURED", message: "Chưa có Agent đang bật để tạo bản nháp gộp." }, { status: 409 });
  const candidates = await query<typeof first>("SELECT id,title,content_markdown,response_policy,service_group FROM knowledge_articles WHERE id<>$1 AND status='published' AND response_policy=$2 AND COALESCE(service_group,'')=COALESCE($3,'')", [first.id, first.response_policy, first.service_group]);
  const lexical = candidates.rows.map((item) => { const score = similarity(`${first.title} ${first.content_markdown}`, `${item.title} ${item.content_markdown}`); return { id: item.id, articleId: item.id, sourceTitle: item.title, content: item.content_markdown, keywordScore: score, score, responsePolicy: item.response_policy as "grounded" }; }).filter((item) => item.score >= 0.2).sort((a, b) => b.score - a.score);
  let provider;
  try { provider = createProvider(providerConfigFromRow(providerRow.rows[0])); } catch { return NextResponse.json({ code: "AGENT_REQUEST_FAILED", message: "Agent đã được cấu hình nhưng chưa thể chuẩn bị yêu cầu tạo nháp. Hãy thử lại sau." }, { status: 502 }); }
  const reranked = await rerankWithProvider(provider, `Bài tri thức có thể trùng với: ${first.title}`, lexical, .45);
  const selected = reranked.sources[0]; const match = selected && { item: candidates.rows.find((item) => item.id === selected.id)!, score: selected.score };
  if (!match || !match.item || match.score < .35) return NextResponse.json({ code: "NO_SUITABLE_MATCH", outcome: "skipped", suggestion: null, message: "Chưa tìm thấy bài đủ tương đồng để tạo bản nháp gộp." });
  const coverage = Math.round(settings.mergeUniqueCoverageThreshold * 100);
  let answer: { answer: string; provider: string };
  try { answer = await provider.generateAnswer({ question: `Phân tích hai bài tri thức để gộp. Chỉ trả JSON: {title:string,content:string,reason:string,conflicts:string[],decision:'merge_full'|'merge_partial'|'keep_separate',sharedTopics:string[],uniqueTopics:{articleA:string[],articleB:string[]},uniqueCoverage:number}. Nếu nội dung riêng của một bài từ ${coverage}% trở lên phải decision='merge_partial'; nếu phạm vi/mâu thuẫn khiến không nên gộp thì 'keep_separate'. content chỉ tạo khi merge_full hoặc merge_partial, giữ thông tin không mâu thuẫn, không bịa thêm. Không dùng [1], [2] hay nhắc nguồn trong content.`, context: [{ sourceTitle: first.title, content: first.content_markdown, score: 1, responsePolicy: first.response_policy as "grounded" }, { sourceTitle: match.item.title, content: match.item.content_markdown, score: match.score, responsePolicy: match.item.response_policy as "grounded" }], persona: "Bạn là chuyên gia quản trị tri thức, trung thực và bảo toàn nguồn." }); } catch { return NextResponse.json({ code: "AGENT_REQUEST_FAILED", message: "Agent đã được cấu hình nhưng không phản hồi khi tạo bản nháp. Hãy thử lại sau." }, { status: 502 }); }
  const jsonText = answer.answer.match(/\{[\s\S]*\}/)?.[0]; let decoded: unknown = null; try { decoded = jsonText ? JSON.parse(jsonText) : null; } catch { /* validated below */ }
  const parsed = generatedSchema.safeParse(decoded);
  if (!parsed.success) return NextResponse.json({ code: "AGENT_INVALID_RESPONSE", message: "Agent đã phản hồi nhưng kết quả tạo nháp chưa hợp lệ. Hãy thử lại." }, { status: 502 });
  const generated = parsed.data;
  if (generated.decision === "keep_separate") return NextResponse.json({ code: "KEEP_SEPARATE", outcome: "skipped", suggestion: null, message: "Agent đánh giá hai bài nên được giữ riêng; không tạo bản nháp gộp." });
  const existingDraft = await query<{ run_id: string; merged_article_id: string }>(
    "SELECT mr.id AS run_id,mr.merged_article_id FROM knowledge_merge_runs mr JOIN knowledge_merge_sources ms ON ms.merge_run_id=mr.id WHERE mr.status='draft' AND ms.article_id=ANY($1::uuid[]) GROUP BY mr.id,mr.merged_article_id HAVING count(DISTINCT ms.article_id)=2 LIMIT 1",
    [[first.id, match.item.id]],
  );
  if (existingDraft.rows[0]) return NextResponse.json({ suggestion: { runId: existingDraft.rows[0].run_id, mergedArticleId: existingDraft.rows[0].merged_article_id, existingDraft: true, sourceTitles: [first.title, match.item.title] }, message: "Đã có bản nháp chờ duyệt cho cặp bài này." });
  const mergedTitle = generated.title?.trim().slice(0, 120) || (first.title.length >= match.item.title.length ? first.title : match.item.title);
  const mergedContent = generated.content?.trim().slice(0, 30000) || `# ${mergedTitle}\n\n${first.content_markdown}\n\n---\n\n## Nội dung đối chiếu bổ sung\n\n${match.item.content_markdown}`;
  const output = await withTransaction(async (client) => { const article = await client.query<{ id: string }>("INSERT INTO knowledge_articles (title,slug,content_markdown,status,is_verified,source_priority,service_group,response_policy,created_by) VALUES ($1,$2,$3,'draft',false,50,$4,$5,$6) RETURNING id", [`${mergedTitle} (bản gộp)`, `merge-${Date.now()}`, mergedContent, first.service_group, first.response_policy, session.userId]); await replaceArticleChunks(client, article.rows[0].id, mergedTitle, mergedContent); const run = await client.query<{ id: string }>("INSERT INTO knowledge_merge_runs (status,score,analysis,merged_article_id,created_by) VALUES ('draft',$1,$2,$3,$4) RETURNING id", [match.score, JSON.stringify({ method: "agent_structured_merge", provider: answer.provider, reason: generated.reason ?? "Agent tạo bản nháp từ hai nguồn.", decision: generated.decision, sharedTopics: generated.sharedTopics ?? [], uniqueTopics: generated.uniqueTopics ?? {}, uniqueCoverage: generated.uniqueCoverage ?? null, conflicts: generated.conflicts ?? [], note: "Bản nháp cần Admin kiểm tra trước khi xuất bản; nguồn chưa bị lưu trữ." }), article.rows[0].id, session.userId]); for (const sourceId of [first.id, match.item.id]) await client.query("INSERT INTO knowledge_merge_sources (merge_run_id,article_id) VALUES ($1,$2)", [run.rows[0].id, sourceId]); return { runId: run.rows[0].id, mergedArticleId: article.rows[0].id }; });
  return NextResponse.json({ suggestion: { ...output, score: match.score, sourceTitles: [first.title, match.item.title] } });
}
