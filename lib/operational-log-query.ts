import { z } from "zod";

export const operationalLogDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const operationalLogFilterSchema = z.object({
  category: z.enum(["account", "authentication", "knowledge", "configuration"]).optional(),
  from: z.string().regex(operationalLogDatePattern).optional(),
  to: z.string().regex(operationalLogDatePattern).optional(),
});

export type OperationalLogFilter = z.infer<typeof operationalLogFilterSchema>;

export function parseOperationalLogFilter(params: Record<string, string>) {
  const parsed = operationalLogFilterSchema.safeParse(params);
  if (!parsed.success) return { error: "Bộ lọc nhật ký không hợp lệ." } as const;
  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    return { error: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." } as const;
  }
  return { filter: parsed.data } as const;
}

function startOfVietnamDay(date: string) {
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}

function nextVietnamDay(date: string) {
  const value = new Date(`${date}T00:00:00+07:00`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString();
}

export function operationalLogWhere(filter: OperationalLogFilter, tableAlias = "") {
  const column = (name: string) => tableAlias ? `${tableAlias}.${name}` : name;
  return {
    values: [
      filter.category ?? null,
      filter.from ? startOfVietnamDay(filter.from) : null,
      filter.to ? nextVietnamDay(filter.to) : null,
    ],
    where: `WHERE ($1::text IS NULL OR ${column("category")}=$1) AND ($2::timestamptz IS NULL OR ${column("created_at")} >= $2) AND ($3::timestamptz IS NULL OR ${column("created_at")} < $3)`,
  };
}
