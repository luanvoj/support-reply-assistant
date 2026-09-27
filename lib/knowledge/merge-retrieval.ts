import { query } from "@/lib/db";
import { getActiveRetrievalSettings } from "@/lib/retrieval/settings";

const fallbackSynonyms = ["record = bản ghi", "txt record = bản ghi txt"];
const norm = (value: string) => value.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function synonymMap(entries: string[]) {
  const result: Record<string, string[]> = {};
  for (const entry of [...fallbackSynonyms, ...entries]) {
    const [left, right, ...extra] = entry.split("=").map((item) => norm(item.trim()));
    if (!left || !right || extra.length) continue;
    result[left] = [...new Set([...(result[left] ?? []), right])];
    result[right] = [...new Set([...(result[right] ?? []), left])];
  }
  return result;
}

export function expandMergeTerms(text: string, entries = fallbackSynonyms) {
  let value = norm(text);
  for (const [from, aliases] of Object.entries(synonymMap(entries))) if (value.includes(from)) value += ` ${aliases.join(" ")}`;
  return value;
}

export async function mergeCandidates(source: { id: string; title: string; summary?: string | null; content: string; serviceGroup: string | null; policy: string }, limit = 10, configuredSynonyms?: string[]) {
  const settings = await getActiveRetrievalSettings();
  const text = expandMergeTerms(`${source.title} ${source.summary ?? ""} ${source.content.slice(0, 5000)}`, configuredSynonyms ?? settings.mergeSynonyms);
  const terms = [...new Set(text.match(/[\p{L}\p{N}]{2,}/gu) ?? [])].slice(0, 24);
  if (!terms.length) return [];
  const result = await query<{ id: string; title: string; content_markdown: string; version: number; score: number }>("SELECT id,title,content_markdown,version,ts_rank_cd(to_tsvector('simple',title||' '||content_markdown),to_tsquery('simple',$1))::float score FROM knowledge_articles WHERE id<>$2 AND status='published' AND COALESCE(service_group,'')=COALESCE($3,'') AND response_policy=$4 AND to_tsvector('simple',title||' '||content_markdown) @@ to_tsquery('simple',$1) ORDER BY score DESC LIMIT $5", [terms.map((term) => `${term}:*`).join(" | "), source.id, source.serviceGroup, source.policy, limit]);
  return result.rows;
}
