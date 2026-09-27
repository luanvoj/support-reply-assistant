import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveRetrievalSettings } from "@/lib/retrieval/settings";
import { requireRole } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";

const schema = z
  .object({
    topK: z.number().int().min(3).max(30),
    maxArticles: z.number().int().min(1).max(8),
    keywordWeight: z.number().min(0).max(1),
    semanticWeight: z.number().min(0).max(1),
    diversityWeight: z.number().min(0).max(1),
    autoAnswerThreshold: z.number().min(0.5).max(1),
    sensitiveThreshold: z.number().min(0.7).max(1),
    sensitiveTopics: z.array(z.string().trim().min(2).max(60)).max(12),
    verifiedOnly: z.boolean(),
    excludeReplaced: z.boolean(),
    shadowMode: z.boolean(),
    mergePrefilterThreshold: z.number().min(0.2).max(0.8),
    mergeSuggestionThreshold: z.number().min(0.5).max(0.98),
    mergeUniqueCoverageThreshold: z.number().min(0.05).max(0.8),
    mergeSynonyms: z.array(z.string().trim().min(5).max(120)).max(30),
  })
  .refine((v) => Math.abs(v.keywordWeight + v.semanticWeight - 1) < 0.01, {
    message: "Trọng số từ khóa và ngữ nghĩa phải có tổng bằng 100%.",
  })
  .refine((v) => v.sensitiveThreshold >= v.autoAnswerThreshold, {
    message: "Ngưỡng chủ đề nhạy cảm phải không thấp hơn ngưỡng tự trả lời.",
  })
  .refine((v) => v.mergePrefilterThreshold < v.mergeSuggestionThreshold, {
    message: "Ngưỡng sàng lọc phải thấp hơn ngưỡng đề xuất gộp.",
  });

export async function GET() {
  await requireRole("admin");
  const history = await query("SELECT id,top_k,max_articles,auto_answer_threshold,sensitive_threshold,shadow_mode,merge_prefilter_threshold,merge_suggestion_threshold,merge_unique_coverage_threshold,updated_at FROM retrieval_settings ORDER BY updated_at DESC LIMIT 10");
  return NextResponse.json({ settings: await getActiveRetrievalSettings(), history: history.rows });
}
export async function POST(request: Request) {
  const session = await requireRole("admin");
  const body = await request.json().catch(() => null) as { restoreId?: string } | null;
  if (!body?.restoreId || !z.string().uuid().safeParse(body.restoreId).success) return NextResponse.json({ error: "Bản cấu hình cần khôi phục không hợp lệ." }, { status: 400 });
  await withTransaction(async (client) => {
    const source = await client.query<Record<string, unknown>>("SELECT * FROM retrieval_settings WHERE id = $1", [body.restoreId]);
    if (!source.rows[0]) throw new Error("Configuration not found");
    const row = source.rows[0];
    await client.query("UPDATE retrieval_settings SET is_active=false WHERE is_active=true");
    await client.query(`INSERT INTO retrieval_settings (top_k,max_articles,keyword_weight,semantic_weight,diversity_weight,auto_answer_threshold,sensitive_threshold,sensitive_topics,verified_only,exclude_replaced,shadow_mode,merge_prefilter_threshold,merge_suggestion_threshold,merge_unique_coverage_threshold,merge_synonyms,is_active,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,$16,$16)`, [row.top_k,row.max_articles,row.keyword_weight,row.semantic_weight,row.diversity_weight,row.auto_answer_threshold,row.sensitive_threshold,row.sensitive_topics,row.verified_only,row.exclude_replaced,row.shadow_mode,row.merge_prefilter_threshold,row.merge_suggestion_threshold,row.merge_unique_coverage_threshold,row.merge_synonyms,session.userId]);
  });
  return NextResponse.json({ settings: await getActiveRetrievalSettings() });
}
export async function PUT(request: Request) {
  const session = await requireRole("admin");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const v = parsed.data;
  await withTransaction(async (client) => {
    await client.query(
      "UPDATE retrieval_settings SET is_active = false WHERE is_active = true",
    );
    await client.query(
      `INSERT INTO retrieval_settings (top_k,max_articles,keyword_weight,semantic_weight,diversity_weight,auto_answer_threshold,sensitive_threshold,sensitive_topics,verified_only,exclude_replaced,shadow_mode,merge_prefilter_threshold,merge_suggestion_threshold,merge_unique_coverage_threshold,merge_synonyms,is_active,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,$16,$16)`,
      [
        v.topK,
        v.maxArticles,
        v.keywordWeight,
        v.semanticWeight,
        v.diversityWeight,
        v.autoAnswerThreshold,
        v.sensitiveThreshold,
        JSON.stringify(v.sensitiveTopics),
        v.verifiedOnly,
        v.excludeReplaced,
        v.shadowMode,
        v.mergePrefilterThreshold,
        v.mergeSuggestionThreshold,
        v.mergeUniqueCoverageThreshold,
        JSON.stringify(v.mergeSynonyms),
        session.userId,
      ],
    );
  });
  return NextResponse.json({ settings: await getActiveRetrievalSettings() });
}
