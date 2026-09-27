import type { RetrievalCandidate } from "@/lib/retrieval/ranking";

export type EvidenceAssessment = {
  score: number;
  state: "grounded" | "needs_expert";
  reasons: string[];
};

/** Evidence confidence is deliberately independent from the retrieval rank. */
export function assessEvidence(
  sources: Array<RetrievalCandidate & { score: number }>,
  thresholds: { autoAnswerThreshold: number },
): EvidenceAssessment {
  if (!sources.length)
    return { score: 0, state: "needs_expert", reasons: ["Không tìm thấy nguồn phù hợp."] };
  const relevance = sources[0].score;
  const distinctArticles = new Set(sources.map((source) => source.articleId)).size;
  const coverage = Math.min(1, distinctArticles / 2);
  const directness = Math.min(1, sources.filter((source) => source.score >= relevance * 0.8).length / 2);
  const agreement = distinctArticles > 1 ? 1 : 0.7;
  const score = Number((relevance * 0.4 + coverage * 0.2 + directness * 0.25 + agreement * 0.15).toFixed(3));
  const state = score >= thresholds.autoAnswerThreshold ? "grounded" : "needs_expert";
  return {
    score,
    state,
    reasons: [
      `Mức liên quan ${Math.round(relevance * 100)}%.`,
      `${distinctArticles} bài viết độc lập hỗ trợ câu trả lời.`,
      state === "needs_expert" ? "Nguồn chưa đủ để trả lời an toàn; cần chuyên gia xác nhận." : "Nguồn đủ để trả lời có căn cứ.",
    ],
  };
}
