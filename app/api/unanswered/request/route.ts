import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db";

const requestSchema = z.object({ sourceMessageId: z.string().uuid() });

export async function POST(request: Request) {
  const session = await requirePermission("ticket:write");
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await withTransaction(async (client) => {
    const source = await client.query<{
      conversation_id: string;
      original_question: string;
      ticket_id: string | null;
      ticket_status: string | null;
    }>(
      "SELECT a.conversation_id, u.content AS original_question, " +
        "uq.id AS ticket_id, uq.status AS ticket_status " +
        "FROM messages a " +
        "JOIN conversations c ON c.id = a.conversation_id AND c.user_id = $2 " +
        "JOIN messages u ON u.conversation_id = a.conversation_id " +
        "AND u.request_id = a.request_id AND u.sender_type = 'user' " +
        "LEFT JOIN unanswered_questions uq ON uq.source_message_id = a.id " +
        "WHERE a.id = $1 AND a.sender_type = 'assistant' AND a.message_mode = 'review' LIMIT 1",
      [parsed.data.sourceMessageId, session.userId],
    );
    const item = source.rows[0];
    if (!item) throw new Error("Không thể tạo yêu cầu cho phản hồi này.");
    if (item.ticket_id) {
      return { created: false, ticketId: item.ticket_id, status: item.ticket_status };
    }

    const inserted = await client.query<{ id: string; status: string }>(
      "INSERT INTO unanswered_questions " +
        "(conversation_id, source_message_id, original_question, reason_code, retrieval_score, created_by) " +
        "VALUES ($1,$2,$3,'expert_requested',NULL,$4) " +
        "ON CONFLICT (source_message_id) WHERE source_message_id IS NOT NULL DO NOTHING " +
        "RETURNING id, status",
      [item.conversation_id, parsed.data.sourceMessageId, item.original_question, session.userId],
    );
    const ticket = inserted.rows[0] ?? (await client.query<{ id: string; status: string }>(
      "SELECT id, status FROM unanswered_questions WHERE source_message_id = $1",
      [parsed.data.sourceMessageId],
    )).rows[0];
    if (!ticket) throw new Error("Không thể tạo yêu cầu chuyên gia.");
    await client.query(
      "UPDATE conversations SET classification = 'escalated', updated_at = now() WHERE id = $1",
      [item.conversation_id],
    );
    return { created: Boolean(inserted.rows[0]), ticketId: ticket.id, status: ticket.status };
  });

  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}
