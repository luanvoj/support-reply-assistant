export type RetrievalCandidate = {
  id: string;
  content: string;
  articleId: string;
  sourceTitle: string;
  keywordScore: number;
  semanticScore?: number;
  responsePolicy?: "grounded" | "partial" | "escalate";
};

function similarity(left: string, right: string) {
  const words = (value: string) =>
    new Set(value.toLocaleLowerCase("vi-VN").match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const a = words(left);
  const b = words(right);
  const union = new Set([...a, ...b]).size;
  if (!union) return 0;
  return [...a].filter((word) => b.has(word)).length / union;
}

export function hybridRank(
  candidates: RetrievalCandidate[],
  topK = 5,
  keywordWeight = 0.4,
  semanticWeight = 0.6,
  maxArticles = 3,
  diversityWeight = 0.3,
) {
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      // Khi semantic index chưa có dữ liệu, chuẩn hóa về keyword thay vì làm mất 60% điểm.
      score:
        candidate.semanticScore === undefined
          ? candidate.keywordScore
          : candidate.keywordScore * keywordWeight +
            candidate.semanticScore * semanticWeight,
    }))
    .sort((a, b) => b.score - a.score);
  const selected: typeof ranked = [];
  const articleIds = new Set<string>();
  const remaining = [...ranked];
  while (remaining.length && selected.length < topK) {
    const next = remaining
      .map((candidate) => ({
        candidate,
        mmr:
          candidate.score -
          diversityWeight *
            Math.max(0, ...selected.map((picked) => similarity(candidate.content, picked.content))),
      }))
      .filter(({ candidate }) =>
        articleIds.has(candidate.articleId) || articleIds.size < maxArticles,
      )
      .sort((a, b) => b.mmr - a.mmr)[0];
    if (!next) break;
    const candidate = next.candidate;
    articleIds.add(candidate.articleId);
    selected.push(candidate);
    remaining.splice(remaining.indexOf(candidate), 1);
  }
  return selected;
}
