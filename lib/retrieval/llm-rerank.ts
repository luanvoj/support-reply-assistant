import type { LLMProvider } from "@/lib/ai/provider";
import type { RetrievalCandidate } from "@/lib/retrieval/ranking";

type RerankResult = { id: string; score: number; reason?: string };

function parse(raw: string, allowed: Set<string>) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return new Map<string, number>();
  const body = JSON.parse(match[0]) as { results?: RerankResult[] };
  return new Map(
    (body.results ?? [])
      .filter((item) => allowed.has(item.id) && Number.isFinite(item.score))
      .map((item) => [item.id, Math.max(0, Math.min(1, Number(item.score)))]),
  );
}

export async function rerankWithProvider(
  provider: LLMProvider,
  question: string,
  candidates: Array<RetrievalCandidate & { score: number }>,
  keywordWeight: number,
) {
  const candidateLimit = candidates.slice(0, 12);
  try {
    const raw = await Promise.race([
      provider.rerankContext({ question, candidates: candidateLimit.map((item) => ({ id: item.id, title: item.sourceTitle, content: item.content })) }),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Re-rank timeout")), 8_000)),
    ]);
    const scores = parse(raw, new Set(candidateLimit.map((item) => item.id)));
    if (!scores.size) return { sources: candidates.map((item) => ({ ...item, score: Math.max(0, Math.min(1, item.score)) })), mode: "lexical" as const };
    const sources = candidates
      .map((item) => ({ ...item, score: Math.max(0, Math.min(1, item.score)) * keywordWeight + (scores.get(item.id) ?? 0) * (1 - keywordWeight) }))
      .sort((a, b) => b.score - a.score);
    return { sources, mode: "llm_rerank" as const };
  } catch {
    return { sources: candidates.map((item) => ({ ...item, score: Math.max(0, Math.min(1, item.score)) })), mode: "lexical" as const };
  }
}
