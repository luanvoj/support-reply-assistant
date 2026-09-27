import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/guard";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requirePermission("conversation:read");
  const requestedStatus = new URL(request.url).searchParams.get("status");
  const status = requestedStatus === "archived" ? "archived" : "active";
  const result = await query(
    `SELECT c.id, c.title, c.status, c.classification, c.updated_at, c.expires_at,
            count(m.id)::int AS message_count,
            max(m.confidence_score) AS max_confidence
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE c.user_id = $1 AND c.status = $2 AND c.expires_at >= now()
     GROUP BY c.id
     ORDER BY c.updated_at DESC
     LIMIT 100`,
    [session.userId, status],
  );
  return NextResponse.json({ conversations: result.rows });
}
