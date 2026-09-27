import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/guard";
import { query } from "@/lib/db";

export async function GET() {
  await requirePermission("conversation:read");
  const result = await query(
    `SELECT
       (SELECT count(*)::int FROM conversations WHERE created_at >= now() - interval '30 days') AS conversations_30d,
       (SELECT count(*)::int FROM messages WHERE sender_type = 'assistant' AND created_at >= now() - interval '30 days') AS assistant_messages_30d,
       (SELECT count(*)::int FROM unanswered_questions WHERE status IN ('new','in_review')) AS unanswered_open,
       (SELECT count(*)::int FROM knowledge_articles WHERE status = 'published') AS published_articles,
       (SELECT count(*)::int FROM ai_provider_settings WHERE is_enabled = true) AS enabled_providers,
       (SELECT round(avg(evidence_score)::numeric, 3) FROM messages WHERE sender_type = 'assistant' AND evidence_score IS NOT NULL AND created_at >= now() - interval '30 days') AS avg_evidence_30d,
       (SELECT count(*)::int FROM retrieval_logs WHERE decision = 'answered' AND created_at >= now() - interval '30 days') AS grounded_answers_30d,
       (SELECT count(*)::int FROM retrieval_logs WHERE decision = 'fallback' AND created_at >= now() - interval '30 days') AS escalated_answers_30d`,
  );
  return NextResponse.json({ summary: result.rows[0] });
}
