import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/guard";
import { getActiveAssistantProfile } from "@/lib/ai/profile";
import { query, withTransaction } from "@/lib/db";

const statusSchema = z.object({ status: z.enum(["active", "archived"]) });
const deleteSchema = z.object({ confirm: z.literal(true) });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission("conversation:read");
  const { id } = await context.params;
  const conversation = await query(
    `SELECT id, title, status, classification, created_at, updated_at, expires_at
     FROM conversations WHERE id = $1 AND user_id = $2`,
    [id, session.userId],
  );
  if (!conversation.rows[0])
    return NextResponse.json(
      { error: "Không tìm thấy hội thoại." },
      { status: 404 },
    );
  const messages = await query(
    `SELECT m.id, m.sender_type, m.content, m.provider_used, m.confidence_score,
            m.retrieval_summary, m.message_mode, m.redacted_at, m.created_at,
            uq.id AS escalation_ticket_id, uq.status AS escalation_ticket_status
     FROM messages m
     LEFT JOIN unanswered_questions uq ON uq.source_message_id = m.id
     WHERE m.conversation_id = $1 ORDER BY m.sequence_no`,
    [id],
  );
  return NextResponse.json({
    conversation: conversation.rows[0],
    messages: messages.rows,
    assistantName: (await getActiveAssistantProfile()).name,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission("conversation:read");
  const { id } = await context.params;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Trạng thái không hợp lệ." },
      { status: 400 },
    );
  const result = await query(
    `UPDATE conversations SET status = $1,
       archived_at = CASE WHEN $1 = 'archived' THEN now() ELSE NULL END,
       updated_at = now()
     WHERE id = $2 AND user_id = $3 AND status <> 'redacted'
     RETURNING id, status, archived_at`,
    [parsed.data.status, id, session.userId],
  );
  if (!result.rows[0])
    return NextResponse.json(
      { error: "Không thể cập nhật hội thoại." },
      { status: 404 },
    );
  return NextResponse.json({ conversation: result.rows[0] });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission("conversation:read");
  const { id } = await context.params;
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";
  if (permanent) {
    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Cần xác nhận trước khi xóa vĩnh viễn hội thoại." },
        { status: 400 },
      );
    const deleted = await withTransaction(async (client) => {
      const owned = await client.query<{ id: string }>(
        "SELECT id FROM conversations WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, session.userId],
      );
      if (!owned.rows[0]) return false;
      // Tickets/reviews belong to the same conversation lifecycle; removing the
      // conversation must not leave orphaned support records behind.
      await client.query("DELETE FROM unanswered_questions WHERE conversation_id = $1", [id]);
      await client.query("DELETE FROM conversations WHERE id = $1 AND user_id = $2", [id, session.userId]);
      return true;
    });
    return deleted
      ? NextResponse.json({ deleted: true })
      : NextResponse.json({ error: "Không tìm thấy hội thoại." }, { status: 404 });
  }
  const result = await query(
    `UPDATE conversations SET status = 'archived', archived_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'active' RETURNING id`,
    [id, session.userId],
  );
  if (!result.rows[0])
    return NextResponse.json(
      { error: "Không thể lưu trữ hội thoại." },
      { status: 404 },
    );
  return NextResponse.json({ archived: true });
}
