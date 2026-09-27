import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { searchPublishedChunks } from "@/lib/retrieval/search";
import { defaultRetrievalSettings } from "@/lib/retrieval/settings";

async function main() {
  const token = randomUUID().replaceAll("-", "");
  const client = await db.connect();
  try {
    const user = await client.query<{ id: string }>("SELECT id FROM users LIMIT 1");
    if (!user.rows[0]) throw new Error("Không có người dùng để chạy smoke test.");
    const add = async (label: string, verified = true, until: string | null = null, replaced = false) => {
      const title = `DNS records ${label} ${token}`;
      const article = await client.query<{ id: string }>(
        `INSERT INTO knowledge_articles (title,slug,status,content_markdown,is_verified,effective_until,replaced_at,created_by,reviewed_by,published_at)
         VALUES ($1,$2,'published',$3,$4,$5,$6,$7,$7,now()) RETURNING id`,
        [title, `${token}-${label}`, "DNS records mô tả thông tin phân giải tên miền.", verified, until, replaced ? new Date().toISOString() : null, user.rows[0].id],
      );
      await client.query("INSERT INTO knowledge_chunks (article_id,chunk_index,content,search_text,context_hint,token_count) VALUES ($1,0,$2,$3,$4,10)", [article.rows[0].id, "DNS records mô tả thông tin phân giải tên miền.", `${title} DNS records mô tả thông tin phân giải tên miền.`, "DNS records"]);
    };
    await add("chinh-xac");
    await add("het-han", true, "2000-01-01T00:00:00.000Z");
    await add("thay-the", true, null, true);
    await add("chua-xac-minh", false);
    const sources = await searchPublishedChunks(`DNS ${token}`, defaultRetrievalSettings);
    const names = sources.map((source) => source.sourceTitle).join("|");
    if (!names.includes("chinh-xac") || /het-han|thay-the|chua-xac-minh/.test(names)) throw new Error("Bộ lọc nguồn retrieval không đúng.");
    const followUpSources = await searchPublishedChunks(`thế record DNS ${token} là gì`, defaultRetrievalSettings);
    if (!followUpSources.some((source) => source.sourceTitle.includes("chinh-xac"))) {
      throw new Error("Fallback cho câu hỏi nối tiếp không tìm được biến thể số ít/số nhiều.");
    }
    console.log("retrieval database smoke passed");
  } finally {
    await client.query("DELETE FROM knowledge_articles WHERE slug LIKE $1", [`${token}-%`]).catch(() => undefined);
    client.release();
    await db.end();
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
