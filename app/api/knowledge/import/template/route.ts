import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { IMPORT_COLUMNS, templateWorkbook } from "@/lib/knowledge/import";

export async function GET(request: Request) {
  await requirePermission("knowledge:read");
  const format = new URL(request.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const workbook = templateWorkbook();
  const data = XLSX.write(workbook, { bookType: format, type: "buffer", bookSST: false });
  return new NextResponse(data, { headers: { "content-type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8", "content-disposition": `attachment; filename=knowledge-import-template.${format}`, "x-template-columns": IMPORT_COLUMNS.join(",") } });
}
