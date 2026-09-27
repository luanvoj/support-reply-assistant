import { readFile } from "node:fs/promises";
import path from "node:path";

import { db, query, withTransaction } from "@/lib/db";
import { replaceArticleChunks } from "@/lib/knowledge/article";

type ImportedItem = { number: number; group: string; title: string; policy: "grounded" | "escalate"; answer: string };
const sourceFile = path.resolve(process.cwd(), "nguon_tri_thuc_demo_50_cau_hoi_.md");
const apply = process.argv.includes("--apply");

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 96); }
function parse(markdown: string): ImportedItem[] {
  let group = "Khác";
  const items: ImportedItem[] = [];
  const matches = markdown.matchAll(/^## ([^\n]+)|^### (\d+)\. ([^\n]+)\?\n\*\*Trạng thái:\*\* ([^\n]+)\n\*\*(?:Trả lời|Phản hồi) chuẩn:\*\* ([^\n]+(?:\n(?!### |## |\*\*Trạng thái:)[^\n]+)*)/gm);
  for (const match of matches) {
    if (match[1]) { group = match[1].trim(); continue; }
    const status = match[4].trim();
    items.push({ number: Number(match[2]), group, title: match[3].trim() + "?", policy: status === "Trả lời có căn cứ" ? "grounded" : "escalate", answer: match[5].trim() });
  }
  return items;
}

async function main() {
  const items = parse(await readFile(sourceFile, "utf8"));
  if (items.length !== 50) throw new Error(`Parser chỉ nhận ${items.length}/50 mục.`);
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", total: items.length, groups: [...new Set(items.map((item) => item.group))], policies: items.reduce((r, i) => ({ ...r, [i.policy]: (r[i.policy] ?? 0) + 1 }), {} as Record<string, number>) }));
  if (!apply) return;
  const admin = await query<{ id: string }>("SELECT id FROM users WHERE role_id IN (SELECT id FROM roles WHERE code='admin') LIMIT 1");
  if (!admin.rows[0]) throw new Error("Không có admin để gán dữ liệu mẫu.");
  for (const item of items) await withTransaction(async (client) => {
    const key = `demo-${String(item.number).padStart(2, "0")}-${slugify(item.title)}`;
    const content = `## Câu hỏi mẫu\n${item.title}\n\n## Phản hồi đã xác minh\n${item.answer}\n\n## Hướng dẫn cho Agent\nChính sách phản hồi: ${item.policy}. Chỉ dùng nội dung này khi câu hỏi phù hợp.`;
    const row = await client.query<{ id: string }>(`INSERT INTO knowledge_articles (title,slug,content_markdown,status,is_verified,source_priority,service_group,response_policy,source_key,source_file,created_by,reviewed_by,published_at) VALUES ($1,$2,$3,'published',true,$4,$5,$6,$7,$8,$9,$9,now()) ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO UPDATE SET title=EXCLUDED.title,content_markdown=EXCLUDED.content_markdown,service_group=EXCLUDED.service_group,response_policy=EXCLUDED.response_policy,updated_at=now(),version=knowledge_articles.version+1 RETURNING id`, [item.title, key, content, item.policy === "grounded" ? 80 : 50, item.group, item.policy, key, path.basename(sourceFile), admin.rows[0].id]);
    await replaceArticleChunks(client, row.rows[0].id, item.title, content);
    await client.query("INSERT INTO knowledge_article_audits (article_id,actor_id,action,version,details) SELECT id,$2,'imported',version,jsonb_build_object('source_key',$3::text) FROM knowledge_articles WHERE id=$1", [row.rows[0].id, admin.rows[0].id, key]);
  });
  console.log("Imported 50 demo knowledge articles.");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.end());
