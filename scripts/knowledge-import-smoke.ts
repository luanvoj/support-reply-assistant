import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

import { db, withTransaction } from "@/lib/db";
import { insertImportedArticle, nextTitle, parseImportFile } from "@/lib/knowledge/import";
import { searchPublishedChunks } from "@/lib/retrieval/search";

async function main() {
  const token = randomUUID().slice(0, 8);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kho tri thức");
  sheet.columns = [
    { header: "title", key: "title" }, { header: "content_markdown", key: "content_markdown" },
    { header: "response_policy", key: "response_policy" }, { header: "source_priority", key: "source_priority" },
  ];
  sheet.addRows([
    { title: `Quy trình khôi phục mật khẩu ${token}`, content_markdown: "Người dùng xác minh email trước khi đặt lại mật khẩu. Sau đó chọn Quên mật khẩu và mở liên kết được gửi qua email.", response_policy: "grounded", source_priority: 80 },
    { title: `Quy trình khôi phục mật khẩu ${token}`, content_markdown: "Khi khách hàng quên mật khẩu, hãy yêu cầu xác minh email rồi sử dụng liên kết đặt lại mật khẩu trong hộp thư.", response_policy: "grounded", source_priority: 50 },
  ]);
  const rows = await parseImportFile((await workbook.xlsx.writeBuffer()) as ArrayBuffer, "smoke.xlsx");
  if (rows.some((row) => row.errors.length)) throw new Error("Parser XLSX đánh dấu sai dữ liệu hợp lệ.");
  const user = await db.query<{ id: string }>("SELECT id FROM users LIMIT 1");
  if (!user.rows[0]) throw new Error("Thiếu người dùng test.");
  const result = await withTransaction(async (client) => {
    const batch = await client.query<{ id: string }>("INSERT INTO knowledge_import_batches (file_name,file_type,status,total_rows,imported_rows,created_by,applied_at) VALUES ('smoke.xlsx','xlsx','imported',2,2,$1,now()) RETURNING id", [user.rows[0].id]);
    const created: string[] = [];
    for (const row of rows) {
      const article = await insertImportedArticle(client, row, user.rows[0].id, batch.rows[0].id, "smoke.xlsx");
      created.push(article.id);
      await client.query("INSERT INTO knowledge_import_rows (batch_id,row_number,original_title,final_title,status,article_id,payload) VALUES ($1,$2,$3,$4,'imported',$5,$6)", [batch.rows[0].id, row.rowNumber, row.title, article.title, article.id, JSON.stringify(row)]);
    }
    const duplicateTitle = await nextTitle(client, rows[0].title);
    if (!duplicateTitle.endsWith("(2)")) throw new Error(`Đổi tên tiêu đề trùng sai: ${duplicateTitle}`);
    return { batchId: batch.rows[0].id, created };
  });
  const found = await searchPublishedChunks(`khôi phục mật khẩu ${token}`);
  if (found.length < 2) throw new Error("Bài vừa import chưa được lập chỉ mục để retrieval.");
  await db.query("INSERT INTO retrieval_logs (query_text,retrieval_mode,top_chunks_json,decision) VALUES ($1,'keyword',$2,'answered')", [`smoke ${token}`, JSON.stringify({ sources: [{ articleId: result.created[0] }] })]);
  await db.query("DELETE FROM retrieval_logs WHERE query_text=$1", [`smoke ${token}`]);
  await withTransaction(async (client) => {
    await client.query("UPDATE knowledge_import_rows SET status='rolled_back',article_id=NULL WHERE batch_id=$1", [result.batchId]);
    await client.query("DELETE FROM knowledge_articles WHERE id=ANY($1::uuid[])", [result.created]);
    await client.query("UPDATE knowledge_import_batches SET status='rolled_back',rolled_back_at=now() WHERE id=$1", [result.batchId]);
  });
  console.log("knowledge import XLSX/duplicate/retrieval/rollback smoke passed");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.end());
