import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db";
import { insertImportedArticle, parseImportFile } from "@/lib/knowledge/import";

export async function POST(request: Request) {
  const session = await requirePermission("knowledge:write"); const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Tệp CSV/XLSX tối đa 5 MB là bắt buộc." }, { status: 400 });
  try {
    const rows = parseImportFile(await file.arrayBuffer(), file.name); const invalidRows = rows.filter((row) => row.errors.length);
    if (invalidRows.length) return NextResponse.json({ error: "Tệp còn dòng không hợp lệ. Hãy sửa trước khi import.", rows: invalidRows }, { status: 400 });
    const result = await withTransaction(async (client) => {
      const batch = await client.query<{ id: string }>("INSERT INTO knowledge_import_batches (file_name,file_type,status,total_rows,imported_rows,invalid_rows,created_by,applied_at) VALUES ($1,$2,'imported',$3,$3,0,$4,now()) RETURNING id", [file.name, file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv", rows.length, session.userId]);
      const imported = [] as Array<{ id: string; title: string }>;
      for (const row of rows) { const article = await insertImportedArticle(client, row, session.userId, batch.rows[0].id, file.name); imported.push(article); await client.query("INSERT INTO knowledge_import_rows (batch_id,row_number,original_title,final_title,status,article_id,payload) VALUES ($1,$2,$3,$4,'imported',$5,$6)", [batch.rows[0].id,row.rowNumber,row.title,article.title,article.id,JSON.stringify(row)]); }
      return { batchId: batch.rows[0].id, imported };
    });
    return NextResponse.json({ batchId: result.batchId, imported: result.imported.length, titles: result.imported.map((item) => item.title) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể import tệp." }, { status: 400 }); }
}
