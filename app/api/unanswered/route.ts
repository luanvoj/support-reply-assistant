import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/guard";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  await requirePermission("ticket:read");
  const status = new URL(request.url).searchParams.get("status");
  const values: string[] = [];
  const where = status ? "WHERE uq.status = $1" : "";
  if (status) values.push(status);
  const result = await query(
    `SELECT uq.id, uq.original_question, uq.reason_code, uq.retrieval_score,
            uq.status, uq.assigned_to, uq.created_at, u.full_name AS creator,
            qr.id AS review_id, qr.status AS review_status
     FROM unanswered_questions uq
     JOIN users u ON u.id = uq.created_by
     LEFT JOIN question_reviews qr ON qr.unanswered_question_id = uq.id
     ${where}
     ORDER BY uq.created_at DESC LIMIT 100`,
    values,
  );
  return NextResponse.json({ questions: result.rows });
}
