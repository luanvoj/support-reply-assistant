import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db";
import { getUserLogSnapshot, writeOperationalLog } from "@/lib/operational-log";

const paramsSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  articleId: z.string().uuid(),
});

const sourceSchema = z.object({
  articleId: z.string().uuid(),
  title: z.string().trim().min(1).max(500).optional(),
  excerpt: z.string().max(2_000).optional(),
  responsePolicy: z.enum(["grounded", "escalate"]).optional(),
  articleVersion: z.number().int().positive().optional(),
  snapshotAt: z.string().datetime().optional(),
  contentSnapshot: z.string().min(1).max(30_000).optional(),
});

function parseSources(value: unknown) {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return [];
    }
  }
  const parsed = z.array(sourceSchema).safeParse(candidate);
  return parsed.success ? parsed.data : [];
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; messageId: string; articleId: string }> },
) {
  const session = await requirePermission("conversation:evidence:read");
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Đường dẫn căn cứ không hợp lệ." }, { status: 400 });
  }

  const { id: conversationId, messageId, articleId } = parsedParams.data;
  const result = await withTransaction(async (client) => {
    const message = await client.query<{ retrieval_summary: unknown }>(
      `SELECT m.retrieval_summary
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       WHERE c.id = $1 AND c.user_id = $2 AND m.id = $3
         AND m.sender_type = 'assistant' AND m.redacted_at IS NULL`,
      [conversationId, session.userId, messageId],
    );
    if (!message.rows[0]) return { state: "missing" as const };

    const sources = parseSources(message.rows[0].retrieval_summary);
    const matchingSources = sources.filter((item) => item.articleId === articleId);
    const source = matchingSources[0];
    if (!source) return { state: "missing" as const };

    const responsePolicy = source.responsePolicy ?? "escalate";
    const snapshotSource = matchingSources.find(
      (item) => item.responsePolicy === "grounded" && item.contentSnapshot,
    );
    const contentMarkdown = snapshotSource?.contentSnapshot;
    if (responsePolicy === "grounded" && !contentMarkdown) {
      return { state: "snapshot_unavailable" as const };
    }

    const actorSnapshot = await getUserLogSnapshot(session.userId, client);
    await writeOperationalLog(
      {
        category: "knowledge",
        action: "knowledge_evidence_opened",
        summary: `${actorSnapshot.username ?? "Người dùng"} đã mở căn cứ trong hội thoại`,
        actorUserId: session.userId,
        actorSnapshot,
        details: {
          conversationId,
          messageId,
          articleId,
          responsePolicy,
          articleVersion: source.articleVersion ?? null,
        },
      },
      client,
    );

    return {
      state: "found" as const,
      source: {
        articleId: source.articleId,
        title: source.title ?? "Tài liệu đã xác minh",
        excerpt: source.excerpt ?? "",
        responsePolicy,
        articleVersion: source.articleVersion ?? null,
        snapshotAt: source.snapshotAt ?? null,
        ...(responsePolicy === "grounded"
          ? { contentMarkdown: contentMarkdown! }
          : {}),
      },
    };
  });

  if (result.state === "missing") {
    return NextResponse.json({ error: "Không tìm thấy căn cứ trong hội thoại này." }, { status: 404 });
  }
  if (result.state === "snapshot_unavailable") {
    return NextResponse.json(
      { error: "Căn cứ này được tạo trước khi hệ thống lưu bản xem chi tiết." },
      { status: 409 },
    );
  }
  return NextResponse.json({ source: result.source });
}
