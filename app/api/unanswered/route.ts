import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/guard";
import { query } from "@/lib/db";

type TicketRow = {
  id: string;
  original_question: string;
  reason_code: string;
  retrieval_score: number | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  creator: string;
  review_id: string | null;
  review_status: string | null;
};

const selectTickets = `SELECT uq.id, uq.original_question, uq.reason_code, uq.retrieval_score,
  uq.status, uq.assigned_to, uq.created_at, u.full_name AS creator,
  qr.id AS review_id, qr.status AS review_status
  FROM unanswered_questions uq
  JOIN users u ON u.id = uq.created_by
  LEFT JOIN question_reviews qr ON qr.unanswered_question_id = uq.id`;

function boundedNumber(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.floor(parsed))) : fallback;
}

export async function GET(request: Request) {
  await requirePermission("ticket:read");
  const params = new URL(request.url).searchParams;
  const page = boundedNumber(params.get("page"), 1, 1, 10_000);
  const pageSize = boundedNumber(params.get("pageSize"), 20, 10, 100);
  const statusParam = params.get("status");
  const openOnly = statusParam === "open";
  const status = ["new", "in_review", "answered", "published", "rejected"].includes(statusParam ?? "")
    ? statusParam
    : null;
  const search = params.get("search")?.trim().slice(0, 100) || null;
  const requestedSelectedId = params.get("id")?.trim() || null;
  const selectedId = requestedSelectedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedSelectedId)
    ? requestedSelectedId
    : null;
  const filters = ` WHERE ($1::text IS NULL OR uq.status::text = $1)
    AND ($3::boolean = false OR uq.status IN ('new', 'in_review'))
    AND ($2::text IS NULL OR uq.original_question ILIKE '%' || $2 || '%' OR u.full_name ILIKE '%' || $2 || '%')`;

  const [tickets, total, selected] = await Promise.all([
    query<TicketRow>(`${selectTickets}${filters} ORDER BY uq.created_at DESC LIMIT $4 OFFSET $5`, [status, search, openOnly, pageSize, (page - 1) * pageSize]),
    query<{ count: number }>(`SELECT count(*)::int AS count FROM unanswered_questions uq JOIN users u ON u.id = uq.created_by${filters}`, [status, search, openOnly]),
    selectedId
      ? query<TicketRow>(`${selectTickets} WHERE uq.id = $1 LIMIT 1`, [selectedId])
      : Promise.resolve({ rows: [] as TicketRow[] }),
  ]);

  return NextResponse.json({
    questions: tickets.rows,
    selected: selected.rows[0] ?? null,
    pagination: { page, pageSize, total: total.rows[0]?.count ?? 0 },
  });
}
