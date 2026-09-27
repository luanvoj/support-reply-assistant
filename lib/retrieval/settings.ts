import { query } from "@/lib/db";

export type RetrievalSettings = {
  topK: number;
  maxArticles: number;
  keywordWeight: number;
  semanticWeight: number;
  diversityWeight: number;
  autoAnswerThreshold: number;
  partialAnswerThreshold: number;
  sensitiveThreshold: number;
  sensitiveTopics: string[];
  verifiedOnly: boolean;
  excludeReplaced: boolean;
  shadowMode: boolean;
  mergePrefilterThreshold: number;
  mergeSuggestionThreshold: number;
  mergeUniqueCoverageThreshold: number;
  mergeSynonyms: string[];
};

export const defaultRetrievalSettings: RetrievalSettings = {
  topK: 10,
  maxArticles: 3,
  keywordWeight: 0.4,
  semanticWeight: 0.6,
  diversityWeight: 0.3,
  autoAnswerThreshold: 0.8,
  partialAnswerThreshold: 0.6,
  sensitiveThreshold: 0.9,
  sensitiveTopics: ["Giá & báo giá", "Hợp đồng", "Bảo mật", "SLA"],
  verifiedOnly: true,
  excludeReplaced: true,
  shadowMode: false,
  mergePrefilterThreshold: 0.4,
  mergeSuggestionThreshold: 0.78,
  mergeUniqueCoverageThreshold: 0.25,
  mergeSynonyms: ["record = bản ghi", "txt record = bản ghi txt"],
};

export async function getActiveRetrievalSettings(): Promise<RetrievalSettings> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM retrieval_settings WHERE is_active = true ORDER BY updated_at DESC LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return defaultRetrievalSettings;
  return {
    topK: Number(row.top_k),
    maxArticles: Number(row.max_articles),
    keywordWeight: Number(row.keyword_weight),
    semanticWeight: Number(row.semantic_weight),
    diversityWeight: Number(row.diversity_weight),
    autoAnswerThreshold: Number(row.auto_answer_threshold),
    partialAnswerThreshold: Number(row.partial_answer_threshold),
    sensitiveThreshold: Number(row.sensitive_threshold),
    sensitiveTopics: Array.isArray(row.sensitive_topics)
      ? row.sensitive_topics.filter(
          (item): item is string => typeof item === "string",
        )
      : defaultRetrievalSettings.sensitiveTopics,
    verifiedOnly: Boolean(row.verified_only),
    excludeReplaced: Boolean(row.exclude_replaced),
    shadowMode: Boolean(row.shadow_mode),
    mergePrefilterThreshold: Number(row.merge_prefilter_threshold ?? defaultRetrievalSettings.mergePrefilterThreshold),
    mergeSuggestionThreshold: Number(row.merge_suggestion_threshold ?? defaultRetrievalSettings.mergeSuggestionThreshold),
    mergeUniqueCoverageThreshold: Number(row.merge_unique_coverage_threshold ?? defaultRetrievalSettings.mergeUniqueCoverageThreshold),
    mergeSynonyms: Array.isArray(row.merge_synonyms)
      ? row.merge_synonyms.filter((item): item is string => typeof item === "string")
      : defaultRetrievalSettings.mergeSynonyms,
  };
}
