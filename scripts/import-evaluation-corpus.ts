import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { db } from "@/lib/db";

const path = resolve(process.argv[2] ?? "dataset_huan_luyen_agent.xlsx");
const xml = execFileSync("unzip", ["-p", path, "xl/worksheets/sheet1.xml"], { encoding: "utf8" });
const decode = (value: string) => value.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&amp;/g, "&");
const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].slice(1).map((row) => [...row[1].matchAll(/<c r="([A-E])\d+"[^>]*>([\s\S]*?)<\/c>/g)].reduce<Record<string, string>>((result, cell) => {
  const text = cell[2].match(/<t[^>]*>([\s\S]*?)<\/t>|<v>([\s\S]*?)<\/v>/)?.slice(1).find(Boolean) ?? "";
  result[cell[1]] = decode(text); return result;
}, {}));

async function main() {
  for (const row of rows) {
    const expected = row.E.includes("một phần") || row.E.includes("Chuyển chuyên gia") ? "fallback" : "grounded";
    const source = row.D.includes("Không có nguồn") ? null : row.D;
    await db.query(`INSERT INTO retrieval_evaluation_cases (external_id,service_group,question,expected_source_title,expected_decision)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (external_id) DO UPDATE SET service_group=EXCLUDED.service_group,question=EXCLUDED.question,expected_source_title=EXCLUDED.expected_source_title,expected_decision=EXCLUDED.expected_decision,imported_at=now()`, [Number(row.A), row.B, row.C, source, expected]);
  }
  console.log(`Imported ${rows.length} evaluation cases.`);
  await db.end();
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
