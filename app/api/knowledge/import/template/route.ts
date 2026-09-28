import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/guard";
import { IMPORT_COLUMNS, importContentType, templateBuffer } from "@/lib/knowledge/import";

export async function GET(request: Request) {
  await requirePermission("knowledge:read");
  const format = new URL(request.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const data = await templateBuffer(format);
  return new NextResponse(data, {
    headers: {
      "content-type": importContentType(format),
      "content-disposition": `attachment; filename=knowledge-import-template.${format}`,
      "x-template-columns": IMPORT_COLUMNS.join(","),
    },
  });
}
