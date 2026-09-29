"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Badge } from "@/components/ui";
import { useFeedback } from "@/components/app-shell";

export type ChatSource = {
  id?: string;
  articleId?: string;
  title?: string;
  score?: number;
  excerpt?: string;
};

export type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  content: string;
  state: "complete" | "pending" | "error";
  mode?:
    | "grounded"
    | "social"
    | "review"
    | "provider_error"
    | "knowledge_suggestions";
  confidence?: number | null;
  sources?: ChatSource[];
  requestId?: string;
  question?: string;
  escalation?: {
    state: "none" | "created";
    ticketId?: string;
    status?: string;
  };
};

function readableApiError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) {
    if (error.includes("Authentication required") || error.includes("Unauthorized"))
      return "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.includes("Permission denied") || error.includes("Forbidden"))
      return "Bạn không có quyền thực hiện thao tác này.";
    if (error.includes("Network") || error.includes("fetch"))
      return "Lỗi kết nối mạng. Hãy kiểm tra kết nối hệ thống.";
    return error;
  }
  return fallback;
}

function CitationAnswer({
  content,
  sources = [],
}: {
  content: string;
  sources?: ChatSource[];
}) {
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const parts = content.split(/(\[\d+\](?:\[\d+\])*)/g);

  return (
    <p className="citation-answer">
      {parts.map((part, partIndex) => {
        if (!/^\[\d+\](?:\[\d+\])*$/.test(part)) return part;
        const citationNumbers = [...part.matchAll(/\[(\d+)\]/g)].map((match) =>
          Number(match[1])
        );
        return (
          <span className="citation-cluster" key={`${part}-${partIndex}`}>
            {citationNumbers.map((number) => {
              const source = sources[number - 1];
              if (!source) return <span key={number}>{`[${number}]`}</span>;
              const isOpen = activeCitation === number;
              return (
                <span className="citation-anchor" key={number}>
                  <button
                    type="button"
                    className="citation-badge"
                    aria-label={`Xem căn cứ ${number}: ${source.title ?? "tài liệu đã xác minh"}`}
                    aria-expanded={isOpen}
                    onClick={() => setActiveCitation(isOpen ? null : number)}
                  >
                    {number}
                  </button>
                  {isOpen && (
                    <span className="citation-popover" role="status">
                      <b>Căn cứ {number}</b>
                      <strong>{source.title ?? "Tài liệu đã xác minh"}</strong>
                      {source.excerpt && <em>{source.excerpt}</em>}
                    </span>
                  )}
                </span>
              );
            })}
          </span>
        );
      })}
    </p>
  );
}

function CitationSources({
  sources,
  mode,
}: {
  sources: ChatSource[];
  mode?: ChatMessage["mode"];
}) {
  const grouped = Array.from(
    sources.reduce((groups, source, index) => {
      const key = source.articleId ?? source.title ?? `source-${index}`;
      const current = groups.get(key) ?? {
        title: source.title ?? "Tài liệu đã xác minh",
        count: 0,
        firstCitation: index + 1,
      };
      current.count += 1;
      groups.set(key, current);
      return groups;
    }, new Map<string, { title: string; count: number; firstCitation: number }>())
  );

  const label =
    mode === "review"
      ? "Nguồn cần chuyên gia rà soát"
      : mode === "knowledge_suggestions"
      ? "Gợi ý từ Kho kiến thức"
      : mode === "provider_error"
      ? "Nguồn đã tìm thấy"
      : "Căn cứ đã dùng";

  return (
    <details className="chat-citation-sources">
      <summary>
        <span>{label}</span>
        <b>{grouped.length} bài viết</b>
      </summary>
      <ul>
        {grouped.map(([key, source]) => (
          <li key={key}>
            <span className="source-number">{source.firstCitation}</span>
            <span>
              <strong>{source.title}</strong>
              <small>{source.count} đoạn được dùng</small>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AssistantScreen() {
  const router = useRouter();
  const { notify } = useFeedback();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [archived, setArchived] = useState(false);
  const [assistantName, setAssistantName] = useState("Trợ lý phản hồi");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversationId");
    if (!id) return;
    setLoadingHistory(true);
    void fetch(`/api/conversations/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((body) => {
        setConversationId(body.conversation.id);
        setArchived(body.conversation.status === "archived");
        if (typeof body.assistantName === "string" && body.assistantName.trim()) {
          setAssistantName(body.assistantName);
        }
        setMessages(
          (body.messages ?? []).map(
            (item: {
              id: string;
              sender_type: "user" | "assistant";
              content: string;
              message_mode?: ChatMessage["mode"];
              confidence_score?: string | number | null;
              retrieval_summary?: ChatMessage["sources"];
              escalation_ticket_id?: string | null;
              escalation_ticket_status?: string | null;
            }) => ({
              id: item.id,
              sender: item.sender_type,
              content: item.content,
              state: "complete" as const,
              mode: item.message_mode,
              confidence:
                item.confidence_score === null || item.confidence_score === undefined
                  ? null
                  : Number(item.confidence_score),
              sources: item.retrieval_summary ?? [],
              escalation: item.escalation_ticket_id
                ? {
                    state: "created" as const,
                    ticketId: item.escalation_ticket_id,
                    status: item.escalation_ticket_status ?? undefined,
                  }
                : { state: "none" as const },
            })
          )
        );
      })
      .catch(() =>
        setMessages([
          {
            id: "history-error",
            sender: "assistant",
            content: "Không thể tải lại hội thoại này.",
            state: "error",
          },
        ])
      )
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const sendRequest = async (
    value: string,
    requestId: string,
    pendingId: string,
    appendUser: boolean
  ) => {
    const text = value.trim();
    if (!text || sending) return;
    setSending(true);
    if (appendUser) {
      setQuestion("");
      setMessages((current) => [
        ...current,
        {
          id: `user-${requestId}`,
          sender: "user",
          content: text,
          state: "complete",
          requestId,
        },
        {
          id: pendingId,
          sender: "assistant",
          content: "",
          state: "pending",
          requestId,
          question: text,
        },
      ]);
    } else {
      setMessages((current) =>
        current.map((item) =>
          item.id === pendingId ? { ...item, content: "", state: "pending" } : item
        )
      );
    }
    try {
      const response = await fetch("/api/assistant/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: text,
          ...(conversationId ? { conversationId } : {}),
          clientMessageId: requestId,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = readableApiError(
          body.error,
          "Không thể gửi câu hỏi. Hãy thử lại."
        );
        setMessages((current) =>
          current.map((item) =>
            item.id === pendingId
              ? {
                  ...item,
                  content: errorMessage,
                  state: "error",
                  question: text,
                }
              : item
          )
        );
        return;
      }
      setConversationId(body.conversationId);
      if (typeof body.assistantName === "string" && body.assistantName.trim()) {
        setAssistantName(body.assistantName);
      }
      window.history.replaceState(
        null,
        "",
        `/assistant?conversationId=${body.conversationId}`
      );
      setMessages((current) =>
        current.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                id: body.messageId ?? item.id,
                content: body.answer,
                state: "complete",
                mode: body.mode,
                confidence: body.confidence,
                sources: body.sources ?? [],
                escalation: body.escalation,
              }
            : item
        )
      );
    } catch {
      setMessages((current) =>
        current.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                content: "Không thể kết nối tới máy chủ. Hãy thử lại.",
                state: "error",
                question: text,
              }
            : item
        )
      );
    } finally {
      setSending(false);
    }
  };

  const ask = (value = question) => {
    const requestId = crypto.randomUUID();
    void sendRequest(value, requestId, `pending-${requestId}`, true);
  };

  const startNewConversation = () => {
    setQuestion("");
    setMessages([]);
    setConversationId(null);
    setArchived(false);
    window.history.replaceState(null, "", "/assistant");
  };

  const restoreConversation = async () => {
    if (!conversationId) return;
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (response.ok) setArchived(false);
  };

  return (
    <AppShell screen="assistant">
      <div className="bento-page-header">
        <div>
          <span className="bento-eyebrow">HỎI ĐÁP & HỖ TRỢ NGHIỆP VỤ</span>
          <h1 className="bento-page-title">Trợ lý phản hồi thông minh</h1>
          <p className="bento-page-desc">
            Trò chuyện tự nhiên; mọi thông tin nghiệp vụ luôn được đối chiếu với tài liệu đã xác minh.
          </p>
        </div>
        <div className="bento-header-actions">
          <Button variant="primary" size="md" onClick={startNewConversation}>
            + Hội thoại mới
          </Button>
        </div>
      </div>

      <div className="bento-assistant-layout">
        <section className="bento-chat-panel">
          <div className="bento-chat-header">
            <div>
              <strong>Phiên làm việc có căn cứ</strong>
              <small>Chỉ trích xuất từ các bài viết đã được xuất bản và kiểm duyệt</small>
            </div>
            <Badge variant="brand" dot pulse size="sm">
              Chống bịa đặt (Anti-hallucination)
            </Badge>
          </div>

          {!messages.length && !loadingHistory && (
            <div className="bento-suggestions">
              <h3 className="bento-suggestions-title">Bạn cần hỗ trợ xử lý vấn đề gì?</h3>
              <p className="bento-suggestions-sub">
                Chọn câu hỏi mẫu bên dưới hoặc nhập trực tiếp vào khung soạn thảo.
              </p>
              <div className="bento-suggestions-grid">
                <button
                  type="button"
                  className="bento-suggestion-btn"
                  onClick={() =>
                    ask("Cách cấu hình ánh xạ thuộc tính SCIM với Okta?")
                  }
                >
                  <span>✦</span>
                  <span>Cấu hình SCIM với Okta</span>
                </button>
                <button
                  type="button"
                  className="bento-suggestion-btn"
                  onClick={() =>
                    ask("Chính sách xóa dữ liệu cho khách hàng là gì?")
                  }
                >
                  <span>✦</span>
                  <span>Chính sách xóa dữ liệu</span>
                </button>
                <button
                  type="button"
                  className="bento-suggestion-btn"
                  onClick={() =>
                    ask("Cơ chế thử lại webhook hoạt động thế nào?")
                  }
                >
                  <span>✦</span>
                  <span>Cơ chế thử lại webhook</span>
                </button>
              </div>
            </div>
          )}

          {loadingHistory ? (
            <div className="ui-empty-state">
              <p className="ui-empty-description">Đang tải lại lịch sử hội thoại…</p>
            </div>
          ) : messages.length ? (
            <div className="bento-chat-stream" aria-live="polite">
              {messages.map((message) => (
                <div
                  className={`bento-message-row ${message.sender}`}
                  key={message.id}
                >
                  <div
                    className={`bento-chat-bubble ${message.state} ${message.mode ?? ""}`}
                  >
                    <div className="bento-message-meta">
                      <b className="bento-message-author">
                        {message.sender === "user" ? "Bạn" : assistantName}
                      </b>
                      {message.sender === "assistant" &&
                        message.confidence !== null &&
                        message.confidence !== undefined &&
                        message.mode !== "social" && (
                          <Badge variant="success" size="sm">
                            {Math.round(message.confidence * 100)}% tin cậy
                          </Badge>
                        )}
                    </div>

                    {message.state === "pending" ? (
                      <div className="bento-typing-wrap">
                        <div className="bento-typing-dots">
                          <span />
                          <span />
                          <span />
                        </div>
                        <span>Trợ lý đang suy nghĩ và đối chiếu tri thức…</span>
                      </div>
                    ) : (
                      <CitationAnswer
                        content={message.content}
                        sources={message.sources}
                      />
                    )}

                    {message.state === "error" &&
                      message.question &&
                      message.requestId && (
                        <Button
                          variant="outline"
                          size="sm"
                          style={{ marginTop: "8px" }}
                          onClick={() =>
                            void sendRequest(
                              message.question!,
                              message.requestId!,
                              message.id,
                              false
                            )
                          }
                        >
                          Thử lại câu hỏi này
                        </Button>
                      )}

                    {message.escalation?.state === "created" &&
                      message.state === "complete" && (
                        <div className="bento-chat-escalation">
                          <Badge variant="warning" size="sm">
                            Đã chuyển chuyên gia
                          </Badge>
                          <span>Câu hỏi cần thông tin bổ sung, yêu cầu đang chờ giải quyết.</span>
                        </div>
                      )}

                    {!!message.sources?.length &&
                      (message.mode === "grounded" ||
                        message.mode === "review" ||
                        message.mode === "provider_error" ||
                        message.mode === "knowledge_suggestions") && (
                        <CitationSources
                          sources={message.sources}
                          mode={message.mode}
                        />
                      )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="ui-empty-state">
              <p className="ui-empty-description">
                Câu trả lời sẽ xuất hiện tại đây kèm trích dẫn nguồn tài liệu tương ứng.
              </p>
            </div>
          )}

          <div className="bento-composer-wrap">
            {archived && (
              <div className="bento-alert-banner" style={{ marginBottom: "8px" }}>
                <span>Hội thoại này hiện đang được lưu trữ.</span>
                <button
                  type="button"
                  className="bento-alert-close"
                  onClick={() => void restoreConversation()}
                >
                  Khôi phục để tiếp tục
                </button>
              </div>
            )}
            <div className="bento-composer-input-row">
              <input
                className="bento-composer-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) ask();
                }}
                placeholder="Nhập câu hỏi cần trợ giúp (ví dụ: cách đổi DNS, chính sách hoàn tiền)…"
                disabled={archived}
              />
              <Button
                variant="primary"
                size="md"
                disabled={archived || sending || !question.trim()}
                onClick={() => ask()}
              >
                {sending ? "Đang gửi…" : "Gửi câu hỏi →"}
              </Button>
            </div>
            <div className="bento-composer-footnote">
              <span aria-hidden="true" />
              <small>Hệ thống tự động tra cứu trong kho tri thức nội bộ đã xác minh</small>
            </div>
          </div>
        </section>

        <aside className="bento-assistant-side" aria-label="Chính sách phản hồi">
          <div className="ui-card bento-side-card">
            <h3>Cách trợ lý xử lý câu hỏi</h3>
            <p>
              Trợ lý đối chiếu ngữ nghĩa với các phân đoạn tri thức đã xuất bản và chỉ đưa ra câu trả lời khi đạt ngưỡng tin cậy.
            </p>
            <ul className="bento-side-stats">
              <li className="bento-side-stat-row">
                <span className="bento-stat-label">Nguồn dữ liệu:</span>
                <span className="bento-stat-val">Kho bài viết xuất bản</span>
              </li>
              <li className="bento-side-stat-row">
                <span className="bento-stat-label">Chế độ căn cứ:</span>
                <span className="bento-stat-val" style={{ color: "var(--success-text)" }}>Bắt buộc trích dẫn</span>
              </li>
              <li className="bento-side-stat-row">
                <span className="bento-stat-label">Khi thiếu căn cứ:</span>
                <span className="bento-stat-val" style={{ color: "var(--warning-text)" }}>Chuyển chuyên gia</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
