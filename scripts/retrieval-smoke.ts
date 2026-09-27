import { assessEvidence } from "@/lib/retrieval/evidence";
import { hybridRank } from "@/lib/retrieval/ranking";
import { rerankWithProvider } from "@/lib/retrieval/llm-rerank";

const candidates = [
  { id: "dns-1", articleId: "dns", sourceTitle: "DNS CNAME", content: "CNAME trỏ bí danh về hostname đích.", keywordScore: 1 },
  { id: "dns-2", articleId: "dns", sourceTitle: "DNS CNAME", content: "CNAME trỏ bí danh về hostname đích.", keywordScore: .98 },
  { id: "sso-1", articleId: "sso", sourceTitle: "SSO", content: "Cấu hình đăng nhập một lần.", keywordScore: .7 },
];

async function main() {
  const ranked = hybridRank(candidates, 2, .5, .5, 2, .6);
  if (ranked.length !== 2 || ranked[1]?.articleId !== "sso") throw new Error("MMR did not diversify sources");
  const evidence = assessEvidence(ranked, { autoAnswerThreshold: .8, partialAnswerThreshold: .6 });
  if (!Number.isFinite(evidence.score)) throw new Error("Evidence score is invalid");
  const insufficient = assessEvidence([], { autoAnswerThreshold: .8, partialAnswerThreshold: .6 });
  if (insufficient.state !== "insufficient") throw new Error("Missing evidence was not rejected");
  const partial = assessEvidence([{ ...ranked[0]!, score: .7 }], { autoAnswerThreshold: .9, partialAnswerThreshold: .6 });
  if (partial.state !== "partial") throw new Error("Partial evidence was not classified");
  const sensitive = assessEvidence(ranked, { autoAnswerThreshold: .9, partialAnswerThreshold: .6 });
  if (sensitive.state === "grounded" && evidence.score < .9) throw new Error("Sensitive threshold was bypassed");
  const fallback = await rerankWithProvider({ rerankContext: async () => "invalid" } as never, "DNS CNAME là gì?", ranked, .4);
  if (fallback.mode !== "lexical") throw new Error("LLM fallback is unsafe");
  const many = Array.from({ length: 1000 }, (_, index) => ({
    id: `bulk-${index}`,
    articleId: `article-${index}`,
    sourceTitle: `Hướng dẫn DNS ${index}`,
    content: index === 0 ? "DNS CNAME trỏ bí danh chính xác về hostname." : "DNS record dùng cho hệ thống khác.",
    keywordScore: index === 0 ? 1 : .4,
    score: index === 0 ? 1 : .4,
  }));
  const reranked = await rerankWithProvider(
    { rerankContext: async () => JSON.stringify({ results: [{ id: "bulk-0", score: 1, reason: "Đúng ngữ cảnh CNAME" }] }) } as never,
    "DNS CNAME là gì?",
    many,
    .4,
  );
  if (reranked.mode !== "llm_rerank" || reranked.sources[0]?.id !== "bulk-0") throw new Error("LLM rerank did not select the relevant source");
  console.log("retrieval smoke passed");
}

void main();
