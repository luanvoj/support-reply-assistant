import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db";

const deleteSchema = z.object({ confirm: z.literal(true) });

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("ticket:write");
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    }
    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Cần xác nhận trước khi xóa yêu cầu." }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const ticket = await client.query<{ conversation_id: string }>(
        `SELECT uq.conversation_id
         FROM unanswered_questions uq
         WHERE uq.id = $1
           AND uq.status = 'new'
           AND NOT EXISTS (
             SELECT 1 FROM question_reviews qr WHERE qr.unanswered_question_id = uq.id
           )
         FOR UPDATE`,
        [id],
      );
      if (!ticket.rows[0]) return { outcome: "not_deletable" as const };

      const conversationId = ticket.rows[0].conversation_id;
      await client.query("DELETE FROM unanswered_questions WHERE id = $1", [id]);
      await client.query(
        `UPDATE conversations
         SET classification = 'normal', updated_at = now()
         WHERE id = $1
           AND classification = 'escalated'
           AND NOT EXISTS (
             SELECT 1 FROM unanswered_questions
             WHERE conversation_id = $1 AND status IN ('new', 'in_review')
           )`,
        [conversationId],
      );
      return { outcome: "deleted" as const };
    });

    if (result.outcome !== "deleted") {
      return NextResponse.json(
        { error: "Chỉ có thể xóa yêu cầu mới chưa được xử lý." },
        { status: 409 },
      );
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "FORBIDDEN" ? "Bạn không có quyền xóa yêu cầu chuyên gia." : "Không thể xóa yêu cầu chuyên gia." },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 },
    );
  }
}
