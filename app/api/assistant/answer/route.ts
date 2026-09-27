import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createProvider, providerConfigFromRow } from "@/lib/ai/providers";
import {
  fallbackFor,
  getActiveAssistantProfile,
  profilePrompt,
} from "@/lib/ai/profile";
import { requirePermission } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";
import {
  loadPublishedChunksByIds,
  normalizeRetrievalQuery,
  searchPublishedChunks,
} from "@/lib/retrieval/search";
import { assessEvidence } from "@/lib/retrieval/evidence";
import { rerankWithProvider } from "@/lib/retrieval/llm-rerank";
import { getActiveRetrievalSettings } from "@/lib/retrieval/settings";

const requestSchema = z.object({
  question: z.string().trim().min(3).max(5000),
  conversationId: z.string().uuid().nullish(),
  clientMessageId: z.string().uuid().optional(),
});

function isSocialConversation(question: string) {
  const normalized = question.trim().toLocaleLowerCase("vi-VN");
  return /^(xin chào|chào bạn|chào|hello|hi|cảm ơn|thanks|thank you|tạm biệt|bạn là ai|bạn có thể giúp gì)/.test(
    normalized,
  );
}

function isAssistantMeta(question: string) {
  return /(bạn (tên|là ai|làm được gì|có thể giúp)|vai trò của bạn|bạn hỗ trợ)/i.test(
    question,
  );
}

function isAmbiguous(question: string) {
  const normalized = question.trim().toLocaleLowerCase("vi-VN");
  return (
    normalized.split(/\s+/).length <= 3 &&
    !isSocialConversation(normalized) &&
    !isAssistantMeta(normalized)
  );
}

function isFollowUpQuestion(question: string) {
  const normalized = question.trim().toLocaleLowerCase("vi-VN");
  return /^(?:thế|vậy|còn|thế thì|vậy thì|cái đó|điều đó|nó)\b/.test(
    normalized,
  );
}

function contextualQuery(question: string, previousQuestion?: string) {
  const withoutLead = question
    .trim()
    .replace(/^(?:thế thì|vậy thì|thế|vậy|còn|cái đó|điều đó|nó)\s*/i, "");
  // For "thế còn sao?", there is no subject left. Reuse the immediately
  // preceding question as a separate retrieval attempt, never concatenate it.
  return normalizeRetrievalQuery(withoutLead).split(/\s+/).filter(Boolean)
    .length >= 2
    ? withoutLead
    : previousQuestion ?? withoutLead;
}

function citedChunkIds(value: unknown) {
  const sourceList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return [];
          }
        })()
      : [];
  return Array.isArray(sourceList)
    ? sourceList
        .map((source) =>
          source && typeof source === "object" && typeof (source as { id?: unknown }).id === "string"
            ? (source as { id: string }).id
            : null,
        )
        .filter((id): id is string => Boolean(id))
    : [];
}

function contextOverlapsQuestion(
  question: string,
  sources: Array<{ content: string; sourceTitle: string }>,
) {
  const terms = normalizeRetrievalQuery(question)
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.replace(/s$/i, ""));
  if (!terms.length) return false;
  const haystack = sources
    .map((source) => `${source.sourceTitle} ${source.content}`)
    .join(" ")
    .toLocaleLowerCase("vi-VN")
    .match(/[\p{L}\p{N}]{2,}/gu)
    ?.map((term) => term.replace(/s$/i, "")) ?? [];
  return terms.some((term) => haystack.includes(term));
}

export async function POST(request: Request) {
  const session = await requirePermission("chat:use");
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const { question, conversationId } = parsed.data;
  const clientMessageId = parsed.data.clientMessageId ?? randomUUID();
  const existing = await query<Record<string, unknown>>(
    `SELECT c.id AS conversation_id, a.id AS message_id, a.content AS answer,
            a.confidence_score AS confidence, a.message_mode AS mode,
            a.retrieval_summary AS sources, uq.id AS escalation_ticket_id,
            uq.status AS escalation_ticket_status
     FROM messages u
     JOIN conversations c ON c.id = u.conversation_id
     LEFT JOIN messages a ON a.request_id = u.request_id AND a.sender_type = 'assistant'
     LEFT JOIN unanswered_questions uq ON uq.source_message_id = a.id
     WHERE u.request_id = $1 AND u.sender_type = 'user' AND c.user_id = $2
     LIMIT 1`,
    [clientMessageId, session.userId],
  );
  if (existing.rows[0]?.answer) {
    const row = existing.rows[0];
    const activeProfile = await getActiveAssistantProfile();
    return NextResponse.json({
      conversationId: row.conversation_id,
      messageId: row.message_id,
      answer: row.answer,
      confidence: row.confidence,
      mode: row.mode,
      sources: row.sources ?? [],
      decision: row.mode === "review" && row.escalation_ticket_id ? "fallback" : row.mode === "review" ? "partial" : "answered",
      assistantName: activeProfile.name,
      escalation: row.escalation_ticket_id
        ? { state: "created", ticketId: row.escalation_ticket_id, status: row.escalation_ticket_status }
        : row.mode === "review"
          ? { state: "available" }
          : { state: "none" },
    });
  }

  if (conversationId) {
    const owned = await query<{ id: string }>(
      "SELECT id FROM conversations WHERE id = $1 AND user_id = $2 AND status = 'active'",
      [conversationId, session.userId],
    );
    if (!owned.rows[0])
      return NextResponse.json(
        { error: "Hội thoại không tồn tại hoặc đã được lưu trữ." },
        { status: 404 },
      );
  }

  const usage = await query<{ minute_count: number; day_count: number }>(
    `SELECT
       count(*) FILTER (WHERE m.created_at >= now() - interval '1 minute')::int AS minute_count,
       count(*) FILTER (WHERE m.created_at >= now() - interval '1 day')::int AS day_count
     FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE c.user_id = $1 AND m.sender_type = 'user'`,
    [session.userId],
  );
  if (
    (usage.rows[0]?.minute_count ?? 0) >= 10 ||
    (usage.rows[0]?.day_count ?? 0) >= 100
  ) {
    return NextResponse.json(
      { error: "Bạn gửi tin nhắn quá nhanh. Vui lòng thử lại sau." },
      { status: 429 },
    );
  }

  const duplicate = await query<{ id: string }>(
    `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE c.user_id = $1 AND m.sender_type = 'user' AND m.content = $2
       AND m.created_at >= now() - interval '3 seconds' LIMIT 1`,
    [session.userId, question],
  );
  if (duplicate.rows[0])
    return NextResponse.json(
      { error: "Tin nhắn trùng đã được gửi." },
      { status: 409 },
    );

  const historyResult = conversationId
    ? await query<{
        sender_type: "user" | "assistant";
        content: string;
        retrieval_summary?: unknown;
        message_mode?: string | null;
        evidence_score?: string | number | null;
      }>(
        `SELECT sender_type, content, retrieval_summary, message_mode, evidence_score FROM messages
         WHERE conversation_id = $1 AND redacted_at IS NULL
         ORDER BY created_at DESC LIMIT 12`,
        [conversationId],
      )
    : { rows: [] };
  const history = historyResult.rows
    .reverse()
    .map((item) => ({ sender: item.sender_type, content: item.content }));
  const previousQuestions = history
    .filter((item) => item.sender === "user")
    .slice(-2)
    .map((item) => item.content);
  const retrievalSettings = await getActiveRetrievalSettings();
  const isFollowUp = isFollowUpQuestion(question);
  const immediateAssistant = historyResult.rows.find(
    (item) => item.sender_type === "assistant" && item.message_mode === "grounded",
  );
  const rewrittenQuestion = isFollowUp
    ? contextualQuery(question, previousQuestions.at(-1))
    : question;
  let sources = await searchPublishedChunks(question, retrievalSettings);
  let retrievalStrategy = "current_question";
  if (!sources.length && isFollowUp && rewrittenQuestion !== question) {
    sources = await searchPublishedChunks(rewrittenQuestion, retrievalSettings);
    retrievalStrategy = "contextual_rewrite";
  }
  let continuitySources: Awaited<ReturnType<typeof loadPublishedChunksByIds>> = [];
  let hasRelevantContinuity = false;
  if (isFollowUp && immediateAssistant) {
    continuitySources = await loadPublishedChunksByIds(
      citedChunkIds(immediateAssistant.retrieval_summary),
      retrievalSettings,
    );
    hasRelevantContinuity = contextOverlapsQuestion(
      rewrittenQuestion,
      continuitySources,
    );
    if (!sources.length && hasRelevantContinuity) {
      sources = continuitySources;
      retrievalStrategy = "previous_citations";
    }
  }
  const profile = await getActiveAssistantProfile();
  const providerRows = await query<Record<string, unknown>>(
    `SELECT * FROM ai_provider_settings WHERE is_enabled = true ORDER BY is_default DESC, fallback_priority NULLS LAST, updated_at DESC`,
  );
  let retrievalMode: "keyword" | "hybrid" = "keyword";
  let shadowSources: typeof sources | null = null;
  if (sources.length && providerRows.rows[0]) {
    const reranked = await rerankWithProvider(
      createProvider(providerConfigFromRow(providerRows.rows[0])),
      question,
      sources,
      retrievalSettings.keywordWeight,
    );
    if (retrievalSettings.shadowMode) shadowSources = reranked.sources;
    else {
      sources = reranked.sources;
      retrievalMode = reranked.mode === "llm_rerank" ? "hybrid" : "keyword";
    }
  }
  const bestScore = sources[0]?.score ?? 0;
  let evidence = assessEvidence(sources, retrievalSettings);
  // A grounded answer may safely carry its evidence forward only when the
  // immediately preceding cited chunks are still active and overlap the
  // follow-up subject. This avoids both a context reset and blind inheritance.
  const previousEvidence = Number(immediateAssistant?.evidence_score ?? 0);
  const continuityFloor =
    isFollowUp &&
    hasRelevantContinuity &&
    immediateAssistant?.message_mode === "grounded" &&
    Number.isFinite(previousEvidence)
      ? Math.min(0.9, Number((previousEvidence * 0.95).toFixed(3)))
      : 0;
  if (continuityFloor > evidence.score) {
    const score = continuityFloor;
    evidence = {
      ...evidence,
      score,
      state:
        score >= retrievalSettings.autoAnswerThreshold
          ? "grounded"
          : score >= retrievalSettings.partialAnswerThreshold
            ? "partial"
            : "insufficient",
      reasons: [
        ...evidence.reasons,
        "Kế thừa căn cứ từ nguồn đã trích dẫn ở lượt ngay trước; nguồn vẫn còn hiệu lực và cùng chủ đề.",
      ],
    };
  }
  let answer = fallbackFor(profile, sources.length > 0);
  let providerUsed: string | null = null;
  let decision: "answered" | "partial" | "fallback" | "provider_error" = "fallback";
  let providerFailure = false;

  const sensitive = retrievalSettings.sensitiveTopics.some((topic) =>
    question
      .toLocaleLowerCase("vi-VN")
      .includes(topic.toLocaleLowerCase("vi-VN")),
  );
  const autoThreshold = sensitive
    ? retrievalSettings.sensitiveThreshold
    : retrievalSettings.autoAnswerThreshold;
  const sourcePolicy = sources.some((source) => source.responsePolicy === "escalate")
    ? "escalate"
    : sources.some((source) => source.responsePolicy === "partial")
      ? "partial"
      : "grounded";
  if ((evidence.score >= autoThreshold || sourcePolicy === "escalate") && providerRows.rows.length) {
    for (const row of providerRows.rows) {
      try {
        const result = await createProvider(
          providerConfigFromRow(row),
        ).generateAnswer({
          question,
          context: sources,
          history,
          persona: profilePrompt(profile),
        });
        if (result.answer) {
          answer = result.answer;
          providerUsed = result.provider;
          decision = sourcePolicy === "escalate" ? "fallback" : sourcePolicy === "partial" ? "partial" : "answered";
          break;
        }
      } catch (error) {
        providerFailure = true;
        console.warn("[assistant.answer] provider generation failed", {
          providerType: row.provider_type,
          error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
        });
      }
    }
  } else if ((evidence.state === "partial" || sourcePolicy === "partial") && providerRows.rows.length) {
    for (const row of providerRows.rows) {
      try {
        const result = await createProvider(providerConfigFromRow(row)).generateAnswer({ question, context: sources, history, persona: `${profilePrompt(profile)}\nNguồn chỉ đủ một phần. Chỉ nêu các ý có căn cứ, nói rõ điều chưa thể xác nhận và không kết luận thay chuyên gia.` });
        if (result.answer) { answer = result.answer; providerUsed = result.provider; decision = "partial"; break; }
      } catch (error) {
        providerFailure = true;
        console.warn("[assistant.answer] provider generation failed", {
          providerType: row.provider_type,
          error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
        });
      }
    }
  } else if (isSocialConversation(question) || isAssistantMeta(question)) {
    decision = "answered";
    for (const row of providerRows.rows) {
      try {
        const result = await createProvider(
          providerConfigFromRow(row),
        ).generateAnswer({
          question,
          context: [],
          history,
          persona: profilePrompt(profile),
        });
        if (result.answer) {
          answer = result.answer;
          providerUsed = result.provider;
          break;
        }
      } catch (error) {
        console.warn("[assistant.answer] social response generation failed", {
          providerType: row.provider_type,
          error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
        });
        answer = isAssistantMeta(question)
          ? `Tôi là ${profile.name}, ${profile.roleDescription.toLocaleLowerCase("vi-VN")}. Tôi có thể trò chuyện tự nhiên và tra cứu thông tin đã được xác minh trong kho tri thức.`
          : `Chào bạn! Tôi là ${profile.name}. Tôi sẵn sàng hỗ trợ tra cứu thông tin cho khách hàng.`;
      }
    }
  } else if (isAmbiguous(question)) {
    decision = "answered";
    answer =
      "Tôi sẵn sàng hỗ trợ. Bạn có thể cho tôi biết rõ hơn nội dung cần tư vấn hoặc bối cảnh của khách hàng không?";
  }

  if (providerFailure && decision === "fallback" && sources.length > 0) {
    answer =
      "Tôi đã tìm thấy nguồn phù hợp, nhưng Agent đang không thể tạo phản hồi. Vui lòng thử lại sau ít phút; câu hỏi này chưa được chuyển thành yêu cầu chuyên gia.";
    decision = "provider_error";
  }

  const mode =
    decision === "provider_error"
      ? "provider_error"
      : decision === "fallback"
      ? "review"
      : decision === "partial"
        ? "review"
        : evidence.score >= autoThreshold
        ? "grounded"
        : "social";
  const classification =
    mode === "social" ? "social" : mode === "review" ? "escalated" : "normal";

  const result = await withTransaction(async (client) => {
    const conversation = conversationId
      ? await client.query<{ id: string }>(
          "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
          [conversationId, session.userId],
        )
      : await client.query<{ id: string }>(
          "INSERT INTO conversations (user_id, title) VALUES ($1,$2) RETURNING id",
          [session.userId, question.slice(0, 80)],
        );
    if (!conversation.rows[0]) throw new Error("Conversation not found");
    const id = conversation.rows[0].id;
    await client.query("SELECT id FROM conversations WHERE id = $1 FOR UPDATE", [id]);
    const lastSequence = await client.query<{ value: string }>(
      "SELECT COALESCE(MAX(sequence_no), 0)::text AS value FROM messages WHERE conversation_id = $1",
      [id],
    );
    const userSequence = Number(lastSequence.rows[0]?.value ?? 0) + 1;
    await client.query(
      "INSERT INTO messages (conversation_id, sender_type, content, request_id, sequence_no) VALUES ($1,'user',$2,$3,$4)",
      [id, question, clientMessageId, userSequence],
    );
    const assistant = await client.query<{ id: string }>(
       `INSERT INTO messages (conversation_id, sender_type, content, provider_used, confidence_score, evidence_score, retrieval_summary, message_mode, request_id, sequence_no)
       VALUES ($1,'assistant',$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        id,
        answer,
        providerUsed,
        bestScore,
        evidence.score,
        JSON.stringify(
          sources.map((source) => ({
            id: source.id,
            articleId: source.articleId,
            title: source.sourceTitle,
            score: source.score,
            responsePolicy: source.responsePolicy,
            excerpt: source.content.slice(0, 260),
          })),
        ),
        mode,
        clientMessageId,
        userSequence + 1,
      ],
    );
    await client.query(
      `UPDATE conversations SET
         status = 'active', last_message_at = now(), updated_at = now(), expires_at = now() + interval '90 days',
         classification = CASE
           WHEN classification = 'knowledge_linked' THEN classification
           WHEN $2 = 'escalated' OR classification = 'escalated' THEN 'escalated'
           ELSE $2
         END
       WHERE id = $1`,
      [id, classification],
    );
    await client.query(
      "INSERT INTO retrieval_logs (message_id, query_text, retrieval_mode, top_chunks_json, decision) VALUES ($1,$2,$3,$4,$5)",
      [assistant.rows[0].id, question, retrievalMode, JSON.stringify({ sources, evidence, shadowSources, retrievalStrategy, rewrittenQuestion: isFollowUp ? rewrittenQuestion : undefined, continuityApplied: continuityFloor > 0 }), decision],
    );
    let escalation: { state: "created"; ticketId: string; status: string } | { state: "available" } | { state: "none" } = { state: decision === "partial" ? "available" : "none" };
    if (decision === "fallback") {
      const ticket = await client.query<{ id: string; status: string }>(
        `INSERT INTO unanswered_questions (conversation_id, source_message_id, original_question, reason_code, retrieval_score, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status`,
        [
          id,
          assistant.rows[0].id,
          question,
          sourcePolicy === "escalate" ? "expert_required" : sources.length ? "low_confidence" : "missing_knowledge",
          evidence.score,
          session.userId,
        ],
      );
      escalation = {
        state: "created",
        ticketId: ticket.rows[0].id,
        status: ticket.rows[0].status,
      };
    }
    return { conversationId: id, messageId: assistant.rows[0].id, escalation };
  });

  return NextResponse.json({
    ...result,
    answer,
    confidence: evidence.score,
    decision,
    mode,
    escalation: result.escalation,
    assistantName: profile.name,
    sources: sources.map((source) => ({
      id: source.id,
      articleId: source.articleId,
      title: source.sourceTitle,
      score: source.score,
      responsePolicy: source.responsePolicy,
      excerpt: source.content.slice(0, 260),
    })),
  });
}
