import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { query } from "@/lib/db";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30),
  category: z.enum(["account", "authentication", "knowledge", "configuration"]).optional(),
  from: z.string().regex(datePattern).optional(),
  to: z.string().regex(datePattern).optional(),
});

function startOfVietnamDay(date: string) {
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}

function nextVietnamDay(date: string) {
  const value = new Date(`${date}T00:00:00+07:00`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString();
}

export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = schema.safeParse(params);
    if (!parsed.success) return NextResponse.json({ error: "Bộ lọc nhật ký không hợp lệ." }, { status: 400 });
    const { page, pageSize, category, from, to } = parsed.data;
    if (from && to && from > to) return NextResponse.json({ error: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." }, { status: 400 });
    const values = [category ?? null, from ? startOfVietnamDay(from) : null, to ? nextVietnamDay(to) : null];
    const where = `WHERE ($1::text IS NULL OR category=$1) AND ($2::timestamptz IS NULL OR created_at >= $2) AND ($3::timestamptz IS NULL OR created_at < $3)`;
    const rows = await query(`SELECT id,category,action,summary,actor_snapshot,target_snapshot,details,created_at FROM operational_logs ${where} ORDER BY created_at DESC LIMIT $4 OFFSET $5`, [...values, pageSize, (page - 1) * pageSize]);
    const total = await query<{ count: number }>(`SELECT count(*)::int count FROM operational_logs ${where}`, values);
    return NextResponse.json({ logs: rows.rows, pagination: { page, pageSize, total: total.rows[0]?.count ?? 0 } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Bạn không có quyền xem nhật ký vận hành." : "Không thể tải nhật ký vận hành." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 });
  }
}
