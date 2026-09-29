import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { query } from "@/lib/db";
import { operationalLogFilterSchema, operationalLogWhere, parseOperationalLogFilter } from "@/lib/operational-log-query";

const schema = operationalLogFilterSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30),
});

export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = schema.safeParse(params);
    const filterResult = parseOperationalLogFilter(params);
    if (!parsed.success || "error" in filterResult) {
      return NextResponse.json({ error: filterResult.error ?? "Bộ lọc nhật ký không hợp lệ." }, { status: 400 });
    }
    const { page, pageSize } = parsed.data;
    const { where, values } = operationalLogWhere(filterResult.filter);
    const rows = await query(
      `SELECT id,category,action,summary,actor_snapshot,target_snapshot,details,created_at
       FROM operational_logs ${where} ORDER BY created_at DESC LIMIT $4 OFFSET $5`,
      [...values, pageSize, (page - 1) * pageSize],
    );
    const total = await query<{ count: number }>(
      `SELECT count(*)::int count FROM operational_logs ${where}`,
      values,
    );
    return NextResponse.json({ logs: rows.rows, pagination: { page, pageSize, total: total.rows[0]?.count ?? 0 } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Bạn không có quyền xem nhật ký vận hành." : "Không thể tải nhật ký vận hành." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 });
  }
}
