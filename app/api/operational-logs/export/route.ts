import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/guard";
import { query } from "@/lib/db";
import { operationalLogExportBuffer, operationalLogExportContentType, type OperationalLogExportFormat, type OperationalLogExportRow } from "@/lib/operational-log-export";
import { operationalLogWhere, parseOperationalLogFilter } from "@/lib/operational-log-query";

const MAX_EXPORT_ROWS = 10_000;

export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const searchParams = new URL(request.url).searchParams;
    const requestedFormat = searchParams.get("format");
    const format = requestedFormat ?? "xlsx";
    if (format !== "csv" && format !== "xlsx") {
      return NextResponse.json({ error: "Định dạng xuất không hợp lệ." }, { status: 400 });
    }
    const filterResult = parseOperationalLogFilter(Object.fromEntries(searchParams));
    if ("error" in filterResult) return NextResponse.json({ error: filterResult.error }, { status: 400 });

    const { where, values } = operationalLogWhere(filterResult.filter, "ol");
    const result = await query<OperationalLogExportRow>(
      `SELECT ol.summary, ol.created_at, ol.category, ol.action, ol.details, ol.target_snapshot,
        COALESCE(NULLIF(ol.actor_snapshot->>'email',''), CASE WHEN actor.status <> 'purged' THEN NULLIF(actor.email,'') END, 'Không còn lưu') AS actor_email
       FROM operational_logs ol
       LEFT JOIN users actor ON actor.id=ol.actor_user_id
       ${where}
       ORDER BY ol.created_at DESC
       LIMIT ${MAX_EXPORT_ROWS + 1}`,
      values,
    );
    if (result.rows.length > MAX_EXPORT_ROWS) {
      return NextResponse.json({ error: `Chỉ có thể xuất tối đa ${MAX_EXPORT_ROWS.toLocaleString("vi-VN")} bản ghi mỗi lần. Hãy thu hẹp khoảng thời gian.` }, { status: 413 });
    }
    const exportFormat = format as OperationalLogExportFormat;
    const data = await operationalLogExportBuffer(result.rows, exportFormat);
    const suffix = filterResult.filter.from || filterResult.filter.to
      ? `${filterResult.filter.from ?? "start"}-${filterResult.filter.to ?? "end"}`
      : "all";
    return new NextResponse(data, {
      headers: {
        "content-type": operationalLogExportContentType(exportFormat),
        "content-disposition": `attachment; filename=operational-logs-${suffix}.${exportFormat}`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Bạn không có quyền xuất nhật ký vận hành." : "Không thể xuất nhật ký vận hành." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 });
  }
}
