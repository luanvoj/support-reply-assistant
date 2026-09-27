import { db, query } from "@/lib/db";
import { assessEvidence } from "@/lib/retrieval/evidence";
import { searchPublishedChunks } from "@/lib/retrieval/search";
import { getActiveRetrievalSettings } from "@/lib/retrieval/settings";

async function main() {
  const settings = await getActiveRetrievalSettings();
  const cases = await query<{ question: string; expected_source_title: string | null; expected_decision: "grounded" | "partial" | "fallback" }>("SELECT question,expected_source_title,expected_decision FROM retrieval_evaluation_cases ORDER BY external_id");
  let decisionCorrect = 0, sourceCorrect = 0, reciprocalRank = 0;
  for (const item of cases.rows) {
    const sources = await searchPublishedChunks(item.question, settings);
    const evidence = assessEvidence(sources, settings);
    const actual = evidence.state === "grounded" ? "grounded" : evidence.state === "partial" ? "partial" : "fallback";
    if (actual === item.expected_decision) decisionCorrect++;
    if (item.expected_source_title) {
      const rank = sources.findIndex((source) => source.sourceTitle.toLocaleLowerCase("vi-VN") === item.expected_source_title!.toLocaleLowerCase("vi-VN"));
      if (rank >= 0) { sourceCorrect++; reciprocalRank += 1 / (rank + 1); }
    }
  }
  const sourceCases = cases.rows.filter((item) => item.expected_source_title).length;
  console.log(JSON.stringify({ total: cases.rows.length, decisionAccuracy: Number((decisionCorrect / cases.rows.length).toFixed(3)), recallAtK: Number((sourceCorrect / sourceCases).toFixed(3)), mrr: Number((reciprocalRank / sourceCases).toFixed(3)), sourceCases }, null, 2));
  await db.end();
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
