import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { parseImportFile } from "@/lib/knowledge/import";

export async function POST(request: Request) {
  await requirePermission("knowledge:write");
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Hãy chọn tệp CSV hoặc XLSX." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Tệp tối đa 5 MB." }, { status: 400 });
  try {
    const rows = await parseImportFile(await file.arrayBuffer(), file.name);
    return NextResponse.json({ fileName: file.name, total: rows.length, valid: rows.filter((row) => !row.errors.length).length, invalid: rows.filter((row) => row.errors.length).length, rows: rows.slice(0, 200) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể đọc tệp." }, { status: 400 }); }
}
