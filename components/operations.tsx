"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { NavigationIcon } from "@/components/navigation-icon";
import { AppFeedbackProvider as SharedFeedbackProvider, AppShell, screenLabels, useFeedback as useSharedFeedback } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { chunkMarkdown } from "@/lib/retrieval/chunker";
import { passwordChecklist, passwordStrength } from "@/lib/auth/users";

type Screen =
  "assistant" | "conversations" | "knowledge" | "queue" | "review" | "settings" | "profile";
type Ticket = {
  id: string;
  original_question: string;
  reason_code: string;
  retrieval_score: number | null;
  status: string;
  creator: string;
  created_at: string;
};
type Article = {
  id: string;
  title: string;
  category: string | null;
  status: string;
  chunk_count: number;
  updated_at: string;
  is_verified?: boolean;
  source_priority?: number;
  review_due_at?: string | null;
  service_group?: string | null;
  response_policy?: "grounded" | "partial" | "escalate";
  source_file?: string | null;
  version?: number;
  merge_run_id?: string | null;
  merge_status?: "draft" | "approved" | "rejected" | "rolled_back" | null;
};
type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  content: string;
  state: "complete" | "pending" | "error";
  mode?: "grounded" | "social" | "review" | "provider_error";
  confidence?: number | null;
  sources?: Array<{
    id?: string;
    articleId?: string;
    title?: string;
    score?: number;
    excerpt?: string;
  }>;
  requestId?: string;
  question?: string;
  escalation?: {
    state: "none" | "available" | "created";
    ticketId?: string;
    status?: string;
  };
};

function useFeedback() {
  return useSharedFeedback();
}

function AppFeedbackProvider({ children }: { children: ReactNode }) { return <SharedFeedbackProvider>{children}</SharedFeedbackProvider>; }

function Shell({ screen, children }: { screen: Screen; children: ReactNode }) {
  return <AppShell screen={screen}>{children}</AppShell>;
}

function Header({
  screen,
  title,
  description,
  action,
}: {
  screen: Screen;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ops-page-head">
      <div>
        <small>KHÔNG GIAN LÀM VIỆC / {screenLabels[screen].toUpperCase()}</small>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Message({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  return value ? (
    <div className={`ops-panel ${className}`.trim()} role="status">
      {value}
    </div>
  ) : null;
}

function readableApiError(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const details = error as {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };
    const fieldError = details.fieldErrors
      ? Object.values(details.fieldErrors)
          .flat()
          .find((item) => typeof item === "string")
      : undefined;
    if (fieldError) return fieldError;
    if (Array.isArray(details.formErrors) && details.formErrors[0]) {
      return details.formErrors[0];
    }
  }
  return fallback;
}

type ChatSource = NonNullable<ChatMessage["sources"]>[number];

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
          Number(match[1]),
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
    }, new Map<string, { title: string; count: number; firstCitation: number }>()),
  );
  const label =
    mode === "review"
      ? "Nguồn cần chuyên gia rà soát"
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

function AssistantScreen() {
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
    const id = new URLSearchParams(window.location.search).get(
      "conversationId",
    );
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
                item.confidence_score === null ||
                item.confidence_score === undefined
                  ? null
                  : Number(item.confidence_score),
              sources: item.retrieval_summary ?? [],
              escalation: item.escalation_ticket_id
                ? { state: "created" as const, ticketId: item.escalation_ticket_id, status: item.escalation_ticket_status ?? undefined }
                : item.message_mode === "review"
                  ? { state: "available" as const }
                  : { state: "none" as const },
            }),
          ),
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
        ]),
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
    appendUser: boolean,
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
          item.id === pendingId
            ? { ...item, content: "", state: "pending" }
            : item,
        ),
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
          "Không thể gửi câu hỏi. Hãy thử lại.",
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
              : item,
          ),
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
        `/assistant?conversationId=${body.conversationId}`,
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
            : item,
        ),
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
            : item,
        ),
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
    <Shell screen="assistant">
      <Header
        screen="assistant"
        title="Trợ lý phản hồi"
        description="Trò chuyện tự nhiên; thông tin nghiệp vụ luôn được đối chiếu với tài liệu đã xác minh."
        action={
          <button className="ops-button primary" onClick={startNewConversation}>
            + Hội thoại mới
          </button>
        }
      />
      <div className="assistant-layout">
        <section className="ops-panel chat-panel">
          <div className="chat-header">
            <div>
              <b>Phiên làm việc có căn cứ</b>
              <small>Chỉ sử dụng bài viết đã xuất bản</small>
            </div>
          </div>
          {!messages.length && !loadingHistory && (
            <div className="suggestions">
              <b>Bạn cần giải quyết việc gì?</b>
              <span>Chọn gợi ý hoặc nhập câu hỏi bên dưới.</span>
              <div>
                <button
                  onClick={() =>
                    ask("Cách cấu hình ánh xạ thuộc tính SCIM với Okta?")
                  }
                >
                  Cấu hình SCIM với Okta
                </button>
                <button
                  onClick={() =>
                    ask("Chính sách xóa dữ liệu cho khách hàng là gì?")
                  }
                >
                  Chính sách xóa dữ liệu
                </button>
                <button
                  onClick={() =>
                    ask("Cơ chế thử lại webhook hoạt động thế nào?")
                  }
                >
                  Cơ chế thử lại webhook
                </button>
              </div>
            </div>
          )}
          {loadingHistory ? (
            <div className="ops-empty">Đang tải lịch sử hội thoại…</div>
          ) : messages.length ? (
            <div className="chat-stream" aria-live="polite">
              {messages.map((message) => (
                <div
                  className={`chat-message ${message.sender}`}
                  key={message.id}
                >
                  <div
                    className={`chat-bubble ${message.state} ${message.mode ?? ""}`}
                  >
                    <div className="chat-message-meta">
                      <b>
                        {message.sender === "user"
                          ? "Bạn"
                          : assistantName}
                      </b>
                      {message.sender === "assistant" &&
                        message.confidence !== null &&
                        message.confidence !== undefined &&
                        message.mode !== "social" && (
                          <span>
                            {Math.round(message.confidence * 100)}% tin cậy
                          </span>
                        )}
                    </div>
                    {message.state === "pending" ? (
                      <span className="typing-indicator">
                        <i />
                        <i />
                        <i /> Trợ lý đang phản hồi
                      </span>
                    ) : (
                      <CitationAnswer
                        content={message.content}
                        sources={message.sources}
                      />
                    )}
                    {message.state === "error" &&
                      message.question &&
                      message.requestId && (
                        <button
                          className="link-button"
                          onClick={() =>
                            void sendRequest(
                              message.question!,
                              message.requestId!,
                              message.id,
                              false,
                            )
                          }
                        >
                          Thử lại
                        </button>
                      )}
                    {message.escalation?.state === "created" &&
                      message.state === "complete" && (
                        <div className="chat-escalation">
                          <span className="warning-pill">Đã chuyển chuyên gia</span>
                          <span>Yêu cầu đang chờ được xác nhận.</span>
                          <button
                            className="ops-button primary"
                            onClick={() => router.push(`/review?id=${message.escalation?.ticketId}`)}
                          >
                            Xem yêu cầu đã chuyển
                          </button>
                        </div>
                      )}
                    {message.escalation?.state === "available" &&
                      message.state === "complete" && (
                        <button
                          className="ops-button"
                          onClick={async () => {
                            const response = await fetch("/api/unanswered/request", {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ sourceMessageId: message.id }),
                            });
                            const body = await response.json().catch(() => ({}));
                            if (!response.ok) {
                              notify(readableApiError(body.error, "Không thể chuyển yêu cầu. Hãy thử lại."), "error");
                              return;
                            }
                            setMessages((current) => current.map((item) =>
                              item.id === message.id
                                ? { ...item, escalation: { state: "created", ticketId: body.ticketId, status: body.status } }
                                : item,
                            ));
                            notify(body.created ? "Đã chuyển yêu cầu để chuyên gia hỗ trợ." : "Yêu cầu này đã được chuyển trước đó.", "success");
                          }}
                        >
                          Yêu cầu chuyên gia hỗ trợ
                        </button>
                      )}
                    {!!message.sources?.length &&
                      (message.mode === "grounded" || message.mode === "review" || message.mode === "provider_error") && (
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
            <div className="ops-empty">
              Câu trả lời sẽ hiển thị tại đây, cùng mức độ tin cậy từ kho kiến
              thức.
            </div>
          )}
          <div className="composer">
            {archived && (
              <div className="archived-conversation-note">
                Hội thoại này đang được lưu trữ.
                <button
                  className="link-button"
                  onClick={() => void restoreConversation()}
                >
                  Khôi phục để tiếp tục
                </button>
              </div>
            )}
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) ask();
              }}
              placeholder="Nhập câu hỏi hỗ trợ khách hàng…"
              disabled={archived}
            />
            <button
              className="ops-button primary"
              disabled={archived || sending || !question.trim()}
              onClick={() => ask()}
            >
              {sending ? "Đang gửi…" : "Gửi ↑"}
            </button>
            <small>
              Chế độ chống bịa đặt · chỉ trả lời từ nguồn đã xác minh
            </small>
          </div>
        </section>
          <aside className="ops-panel chat-side" aria-label="Cách Trợ lý xử lý câu hỏi">
            <div>
              <b>Cách Trợ lý xử lý câu hỏi</b>
              <small>
                Trợ lý chỉ trả lời khi có nguồn phù hợp. Nếu chưa đủ căn cứ, câu hỏi sẽ được chuyển để rà soát.
              </small>
            </div>
            <dl>
              <div>
                <dt>Nguồn trả lời</dt>
                <dd>Bài viết đã xuất bản</dd>
              </div>
              <div>
                <dt>Khi chưa đủ căn cứ</dt>
                <dd>Chuyển vào hàng đợi rà soát</dd>
              </div>
            </dl>
          </aside>
      </div>
    </Shell>
  );
}

function ConversationsScreen() {
  const router = useRouter();
  const { confirm, notify } = useFeedback();
  const [items, setItems] = useState<
    Array<{
      id: string;
      title: string;
      message_count: number;
      updated_at: string;
      max_confidence: number | null;
      classification: "social" | "normal" | "escalated" | "knowledge_linked";
      status: "active" | "archived";
      expires_at: string;
    }>
  >([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  useEffect(() => {
    void fetch(`/api/conversations?status=${status}`)
      .then((r) => r.json())
      .then((b) => setItems(b.conversations ?? []));
  }, [status]);
  const visible = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()),
  );
  const deletePermanently = async (item: (typeof items)[number]) => {
    if (!await confirm({ title: "Xóa vĩnh viễn hội thoại?", description: `“${item.title}” cùng toàn bộ tin nhắn và ticket liên quan sẽ bị xóa, không thể khôi phục.`, confirmLabel: "Xóa vĩnh viễn", tone: "danger" })) return;
    const response = await fetch(`/api/conversations/${item.id}?permanent=true`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    if (response.ok) {
      setItems((current) => current.filter((conversation) => conversation.id !== item.id));
      notify("Đã xóa vĩnh viễn hội thoại.", "success");
    } else notify("Không thể xóa hội thoại. Vui lòng thử lại.", "error");
  };
  return (
    <Shell screen="conversations">
      <Header
        screen="conversations"
        title="Lịch sử hội thoại"
        description="Tra cứu các phiên hỏi đáp và phản hồi đã tạo."
      />
      <div className="ops-panel">
        <div
          className="conversation-tabs"
          role="tablist"
          aria-label="Trạng thái hội thoại"
        >
          <button
            className={status === "active" ? "selected" : ""}
            onClick={() => setStatus("active")}
          >
            Đang hoạt động
          </button>
          <button
            className={status === "archived" ? "selected" : ""}
            onClick={() => setStatus("archived")}
          >
            Đã lưu trữ
          </button>
          <span>Lịch sử được lưu tối đa 90 ngày</span>
        </div>
        <div className="ops-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tiêu đề hội thoại…"
          />
        </div>
        <div className="ops-table">
          <table>
            <thead>
              <tr>
                <th>Hội thoại</th>
                <th>Số tin nhắn</th>
                <th>Cập nhật</th>
                <th>Độ tin cậy</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.title}</b>
                      <small>{item.id.slice(0, 8)}</small>
                    </td>
                    <td>{item.message_count}</td>
                    <td>{new Date(item.updated_at).toLocaleString("vi-VN")}</td>
                    <td>
                      {item.max_confidence === null
                        ? "—"
                        : `${Math.round(Number(item.max_confidence) * 100)}%`}
                    </td>
                    <td className="conversation-actions">
                      <button
                        className="link-button"
                        onClick={() =>
                          router.push(`/assistant?conversationId=${item.id}`)
                        }
                      >
                        Mở
                      </button>
                      {status === "active" && (
                        <button
                          className="link-button muted"
                          onClick={async () => {
                            const response = await fetch(
                              `/api/conversations/${item.id}`,
                              { method: "DELETE" },
                            );
                            if (response.ok)
                              setItems((current) =>
                                current.filter(
                                  (conversation) => conversation.id !== item.id,
                                ),
                              );
                          }}
                        >
                          Lưu trữ
                        </button>
                      )}
                      <button
                        className="link-button danger"
                        onClick={() => void deletePermanently(item)}
                      >
                        Xóa vĩnh viễn
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>Chưa có hội thoại phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

function KnowledgeScreen() {
  const { confirm, notify } = useFeedback();
  const [articles, setArticles] = useState<Article[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isVerified, setIsVerified] = useState(true);
  const [sourcePriority, setSourcePriority] = useState(50);
  const [reviewDueAt, setReviewDueAt] = useState("");
  const [serviceGroup, setServiceGroup] = useState("");
  const [responsePolicy, setResponsePolicy] = useState<"grounded" | "partial" | "escalate">("grounded");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<string | null>(null);
  const [articleFilter, setArticleFilter] = useState("");
  const [articleStatus, setArticleStatus] = useState<"published" | "draft" | "archived">("published");
  const [articlePage,setArticlePage]=useState(1); const [articleTotal,setArticleTotal]=useState(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ total: number; valid: number; invalid: number; rows: Array<{ rowNumber: number; title: string; errors: string[] }> } | null>(null);
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMergeWorkspace, setShowMergeWorkspace] = useState(false);
  const [mergeBatch, setMergeBatch] = useState<{id:string;status:string;total_articles:number;scanned_articles:number;proposed_groups:number;error_code?:string;error_message?:string} | null>(null);
  const [mergeItems, setMergeItems] = useState<Array<{id:string;article_ids:string[];score:number;reason:string;status:string;merge_run_id?:string;merge_status?:string;decision?:string;analysis?:{sharedTopics?:string[];uniqueTopics?:{articleA?:string[];articleB?:string[]};uniqueCoverage?:number};error_code?:string;error_message?:string;errors?:Array<{code:string;user_message:string;created_at:string}>}>>([]);
  const [mergeDiff,setMergeDiff]=useState<{run:{id:string;title:string;content_markdown:string;status:string};sources:Array<{title:string;content_markdown:string;status:string}>}|null>(null);
  const [selectedMergeItems,setSelectedMergeItems]=useState<string[]>([]); const [generatingMerge,setGeneratingMerge]=useState(false);
  const [mergeLimit,setMergeLimit]=useState(100); const [mergeThreshold,setMergeThreshold]=useState(.78); const [mergeGroup,setMergeGroup]=useState("");
  const editorRef = useRef<HTMLElement | null>(null);
  const editorTitleRef = useRef<HTMLInputElement | null>(null);
  const contentLimit = 30000;
  const hasArticleChanges = !editingId || editSnapshot !== JSON.stringify({ title, content, isVerified, sourcePriority, reviewDueAt, serviceGroup, responsePolicy });
  const chunkPreview = useMemo(() => (content.trim() ? chunkMarkdown(content).slice(0, 3) : []), [content]);
  const load = async () => {
    const response = await fetch(`/api/knowledge/articles?status=${articleStatus}&page=${articlePage}`);
    const body = await response.json().catch(() => ({}));
    if (response.ok) {setArticles(body.articles ?? []);setArticleTotal(body.pagination?.total??0);}
    else setMessage("Không thể tải kho kiến thức.");
  };
  useEffect(() => {
    void load();
  }, [articleStatus,articlePage]);
  useEffect(() => {
    if (!editingId || !showForm) return;
    const frame = window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      editorTitleRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingId, showForm]);
  useEffect(() => {
    if (!showImport) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !importing) setShowImport(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showImport, importing]);
  const create = async (articleStatus: "draft" | "published") => {
    const slug =
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `bai-viet-${Date.now()}`;
    const response = await fetch(editingId ? `/api/knowledge/articles/${editingId}` : "/api/knowledge/articles", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        contentMarkdown: content,
        status: articleStatus,
        isVerified,
        sourcePriority,
        serviceGroup: serviceGroup || null,
        responsePolicy,
        reviewDueAt: reviewDueAt ? new Date(reviewDueAt).toISOString() : undefined,
      }),
    });
    if (response.ok) {
      setMessage(
        articleStatus === "published"
          ? editingId ? "Đã cập nhật, xuất bản và lập chỉ mục bài viết." : "Đã xuất bản và lập chỉ mục bài viết."
          : editingId ? "Đã cập nhật bản nháp." : "Đã lưu bản nháp.",
      );
      setShowForm(false);
      setTitle("");
      setContent("");
      setIsVerified(true);
      setSourcePriority(50);
      setReviewDueAt("");
      setServiceGroup("");
      setResponsePolicy("grounded");
      setEditingId(null);
      void load();
    } else
      setMessage("Không thể tạo bài viết. Hãy kiểm tra quyền và nội dung.");
  };
  const edit = async (id: string) => {
    const response = await fetch(`/api/knowledge/articles/${id}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage("Không thể tải bài viết để chỉnh sửa.");
    const item = body.article;
    setEditingId(id); setTitle(item.title ?? ""); setContent(item.content_markdown ?? "");
    setIsVerified(Boolean(item.is_verified)); setSourcePriority(Number(item.source_priority ?? 50));
    setReviewDueAt(item.review_due_at ? String(item.review_due_at).slice(0, 10) : "");
    setServiceGroup(item.service_group ?? ""); setResponsePolicy(item.response_policy ?? "grounded"); setEditSnapshot(JSON.stringify({ title:item.title ?? "", content:item.content_markdown ?? "", isVerified:Boolean(item.is_verified), sourcePriority:Number(item.source_priority ?? 50), reviewDueAt:item.review_due_at ? String(item.review_due_at).slice(0,10) : "", serviceGroup:item.service_group ?? "", responsePolicy:item.response_policy ?? "grounded" })); setShowForm(true);
  };
  const archive = async (id: string) => {
    if (!await confirm({ title: "Lưu trữ bài viết?", description: "Agent sẽ không dùng bài viết này cho câu trả lời mới. Bạn vẫn có thể xem và xóa vĩnh viễn sau đó.", confirmLabel: "Lưu trữ" })) return;
    const response = await fetch(`/api/knowledge/articles/${id}`, { method: "DELETE" });
    if (response.ok) notify("Đã lưu trữ bài viết khỏi kho tri thức.", "success"); else notify("Không thể lưu trữ bài viết.", "error");
    if (response.ok) void load();
  };
  const purge = async (item: Article) => {
    if (!await confirm({ title: "Xóa vĩnh viễn bài viết?", description: "Bài viết và các đoạn tìm kiếm của nó sẽ bị xóa. Hành động này không thể khôi phục.", confirmLabel: "Xóa vĩnh viễn", tone: "danger", requiredValue: item.title })) return;
    const response = await fetch(`/api/knowledge/articles/${item.id}?permanent=true`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) notify("Đã xóa vĩnh viễn bài viết.", "success"); else notify(body.error ?? "Không thể xóa vĩnh viễn bài viết.", "error");
    if (response.ok) void load();
  };
  const restore = async (item: Article) => { const response=await fetch(`/api/knowledge/articles/${item.id}/restore`,{method:"POST"}); const body=await response.json().catch(()=>({})); if(response.ok){notify("Đã khôi phục bài viết thành bản nháp để bạn rà soát.","success");void load();}else notify(body.error??"Không thể khôi phục bài viết.","error"); };
  const previewImport = async (file: File) => {
    setImportFile(file); setImportPreview(null); setMessage("");
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/knowledge/import/preview", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setImportPreview(body); else setMessage(body.error ?? "Không thể kiểm tra tệp import.");
  };
  const applyImport = async () => {
    if (!importFile || !importPreview || importPreview.invalid) return;
    setImporting(true); const form = new FormData(); form.append("file", importFile);
    const response = await fetch("/api/knowledge/import", { method: "POST", body: form }); const body = await response.json().catch(() => ({})); setImporting(false);
    if (response.ok) { notify(`Đã import ${body.imported} bài viết và lập chỉ mục để Agent tra cứu.`, "success"); setImportFile(null); setImportPreview(null); setShowImport(false); void load(); }
    else setMessage(body.error ?? "Không thể import tệp.");
  };
  const suggestMerge = async (item: Article) => {
    const response = await fetch("/api/knowledge/merge/suggest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ articleId: item.id }) }); const body = await response.json().catch(() => ({}));
    if (response.ok && body.suggestion) { notify(`Đã tạo bản nháp gộp từ “${body.suggestion.sourceTitles.join("” và “")}”. Hãy mở bài nháp để kiểm tra trước khi xuất bản.`, "success"); void load(); }
    else notify(body.message ?? body.error ?? "Chưa thể tạo đề xuất gộp bài viết.", "info");
  };
  const decideMerge = async (item: Article, decision: "approve" | "reject") => {
    if (!item.merge_run_id) return;
    const accepted = await confirm({ title: decision === "approve" ? "Xuất bản bản gộp?" : "Từ chối bản gộp?", description: decision === "approve" ? "Bài gộp sẽ được xuất bản; hai bài nguồn sẽ chuyển sang lưu trữ nhưng vẫn được giữ để đối soát." : "Bản nháp gộp sẽ được lưu trữ; hai bài nguồn vẫn không thay đổi.", confirmLabel: decision === "approve" ? "Duyệt và lưu trữ nguồn" : "Từ chối" });
    if (!accepted) return; const response=await fetch(`/api/knowledge/merge/${item.merge_run_id}/${decision}`,{method:"POST"}); const body=await response.json().catch(()=>({})); if(response.ok){notify(decision === "approve" ? "Đã xuất bản bài gộp và lưu trữ nguồn để đối soát." : "Đã từ chối bản gộp; nguồn được giữ nguyên.","success");void load();}else notify(body.error??"Không thể cập nhật đề xuất gộp.","error");
  };
  const loadMergeBatch=async(id:string)=>{const r=await fetch(`/api/knowledge/merge/batches/${id}`);const b=await r.json().catch(()=>({}));if(r.ok){setMergeBatch(b.batch);setMergeItems(b.items??[]);}};
  const startMergeBatch=async()=>{setMergeItems([]);setSelectedMergeItems([]);setMergeDiff(null);const r=await fetch("/api/knowledge/merge/batches",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({limit:mergeLimit,threshold:mergeThreshold,serviceGroup:mergeGroup||undefined,verifiedOnly:true})});const b=await r.json().catch(()=>({}));if(!r.ok){notify(b.error??"Không thể tạo đợt gộp.","error");return;}setMergeBatch(b.batch);const scan=await fetch(`/api/knowledge/merge/batches/${b.batch.id}/scan`,{method:"POST"});if(!scan.ok){const e=await scan.json().catch(()=>({}));notify(`${e.error??"Quét gộp không hoàn tất."}${e.code?` Mã: ${e.code}`:""}`,"error");}await loadMergeBatch(b.batch.id);};
  const cancelMergeBatch=async()=>{if(!mergeBatch)return;const r=await fetch(`/api/knowledge/merge/batches/${mergeBatch.id}/cancel`,{method:"POST"});if(r.ok)await loadMergeBatch(mergeBatch.id);};
  const saveMergeOutcome=async(itemId:string,code:string)=>fetch(`/api/knowledge/merge/batches/${mergeBatch?.id}/items/${itemId}/fail`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});
  const generateSelectedMerges=async(itemIds=selectedMergeItems)=>{if(!mergeBatch||!itemIds.length)return;setGeneratingMerge(true);let done=0;let failed=0;let skipped=0;for(const item of mergeItems.filter(x=>itemIds.includes(x.id))){const suggest=await fetch('/api/knowledge/merge/suggest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({articleId:item.article_ids[0]})}).catch(()=>null);const payload=await suggest?.json().catch(()=>({}));if(!suggest||!suggest.ok||!payload.suggestion){const code=payload?.code??'AGENT_REQUEST_FAILED';const result=await saveMergeOutcome(item.id,code);const outcome=await result.json().catch(()=>({}));if(outcome.status==='skipped')skipped++;else failed++;continue;}const attached=await fetch(`/api/knowledge/merge/batches/${mergeBatch.id}/items/${item.id}/attach`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mergeRunId:payload.suggestion.runId})}).catch(()=>null);if(!attached?.ok){await saveMergeOutcome(item.id,'ATTACH_FAILED');failed++;continue;}done++;}setGeneratingMerge(false);const summary=[done?`đã tạo ${done} bản nháp`:null,skipped?`${skipped} nhóm được giữ riêng`:null,failed?`${failed} nhóm cần xử lý`:null].filter(Boolean).join('; ');notify(summary?`${summary[0].toUpperCase()}${summary.slice(1)}.`:'Không có nhóm nào được xử lý.',failed?'error':'success');await loadMergeBatch(mergeBatch.id);void load();};
  const openMergeDiff=async(id:string)=>{const r=await fetch(`/api/knowledge/merge/${id}`);const b=await r.json().catch(()=>({}));if(r.ok)setMergeDiff({run:b.run,sources:b.sources});else notify(b.error??'Không thể tải đối chiếu.',"error")};
  const mergeDecisionText=(item:{decision?:string;merge_status?:string})=>item.merge_status==='approved'?'Đã gộp và duyệt':item.decision==='merge_full'||item.decision==='merge_partial'?'Đã tạo nháp':item.decision==='keep_separate'?'Giữ nguyên':'Đã tạo nháp';
  return (
    <Shell screen="knowledge">
      <Header
        screen="knowledge"
        title="Kho kiến thức"
        description="Quản lý các nguồn được phép dùng để trả lời khách hàng."
        action={
          <div className="header-actions"><button className="ops-button" onClick={() => setShowImport(true)}>Nhập dữ liệu</button><button className="ops-button" onClick={() => setShowMergeWorkspace(!showMergeWorkspace)}>Gộp bài viết</button>{!showForm&&<button className="ops-button primary" onClick={() => setShowForm(true)}>+ Thêm bài viết</button>}</div>
        }
      />
      <Message value={message} />
      {showMergeWorkspace && <section className="ops-panel merge-workspace"><div className="merge-heading"><div><b>Gộp bài viết theo đợt</b><small>Hệ thống chỉ đề xuất các bài cùng nhóm dịch vụ và chính sách phản hồi. Bạn luôn duyệt trước khi nguồn bị lưu trữ.</small></div>{mergeBatch&&["queued","scanning","generating"].includes(mergeBatch.status)&&<button className="ops-button" onClick={()=>void cancelMergeBatch()}>Hủy đợt</button>}</div>{!mergeBatch||["failed","cancelled","completed"].includes(mergeBatch.status)?<div className="merge-controls"><label>Nhóm dịch vụ<input value={mergeGroup} onChange={e=>setMergeGroup(e.target.value)} placeholder="Toàn kho"/></label><label>Số bài tối đa <input type="number" min="10" max="200" value={mergeLimit} onChange={e=>setMergeLimit(Number(e.target.value))}/></label><label>Ngưỡng tương đồng {Math.round(mergeThreshold*100)}%<input type="range" min="0.5" max="0.98" step="0.01" value={mergeThreshold} onChange={e=>setMergeThreshold(Number(e.target.value))}/></label><button className="ops-button primary" onClick={()=>void startMergeBatch()}>Bắt đầu quét</button></div>:<div className="merge-progress"><b>{mergeBatch.status === "review_ready" ? "Đã sẵn sàng để rà soát" : "Đang quét và xếp hạng bài viết"}</b><progress value={mergeBatch.scanned_articles} max={Math.max(mergeBatch.total_articles,1)}/><span>{mergeBatch.scanned_articles}/{mergeBatch.total_articles} bài · {mergeBatch.proposed_groups} nhóm đề xuất</span>{mergeBatch.error_code&&<small>Mã lỗi {mergeBatch.error_code}: {mergeBatch.error_message}</small>}</div>}{mergeBatch?.status==="review_ready"&&!mergeItems.length&&<div className="merge-empty"><b>Chưa tìm thấy nhóm bài viết phù hợp</b><p>Đợt quét đã hoàn tất với {mergeBatch.total_articles} bài. Hãy mở rộng nhóm dịch vụ, tăng số bài quét hoặc hạ ngưỡng tương đồng để thử lại.</p><span>Tiêu chí đã dùng: {mergeGroup||"toàn kho"} · tối đa {mergeLimit} bài · từ {Math.round(mergeThreshold*100)}% tương đồng</span><button className="ops-button primary" onClick={()=>{setMergeBatch(null);setMergeItems([]);setMergeDiff(null)}}>Điều chỉnh tiêu chí</button></div>}{mergeItems.length>0&&<div className="merge-candidate-list"><div className="merge-selection"><b>Nhóm được đề xuất</b><button className="ops-button primary" disabled={!selectedMergeItems.length||generatingMerge} onClick={()=>void generateSelectedMerges()}>{generatingMerge?"Đang tạo nháp…":`Tạo nháp (${selectedMergeItems.length})`}</button></div>{mergeItems.map(item=><div key={item.id} className={`merge-candidate ${item.status==='failed'?'merge-candidate-error':''}`}><input type="checkbox" disabled={['drafted','skipped'].includes(item.status)} checked={selectedMergeItems.includes(item.id)} onChange={e=>setSelectedMergeItems(v=>e.target.checked?[...v,item.id]:v.filter(id=>id!==item.id))}/><span><strong>{Math.round(item.score*100)}% tương đồng</strong><small>{item.status==='failed'||item.status==='skipped'?item.error_message??item.reason:item.reason}</small>{item.status==='drafted'&&<em className="merge-decision">{mergeDecisionText(item)}</em>}{item.status==='skipped'&&<em className="merge-decision neutral">Giữ riêng</em>}{item.status==='failed'&&<details className="merge-error-detail"><summary>Mã {item.error_code??'UNKNOWN'} · Xem chi tiết</summary><p>{item.errors?.[0]?.user_message??item.error_message??'Chưa có chi tiết lỗi.'}</p><button type="button" className="link-button" onClick={()=>void generateSelectedMerges([item.id])}>Thử lại nhóm này</button></details>}</span><span>{item.status==='drafted'?<button type="button" className="link-button" onClick={()=>item.merge_run_id&&void openMergeDiff(item.merge_run_id)}>Xem đối chiếu</button>:item.status==='failed'?'Cần xử lý':item.status==='skipped'?'Không tạo nháp':`${item.article_ids.length} bài trong nhóm`}</span></div>)}</div>}{mergeDiff&&<section className="merge-diff"><div><b>Bản nháp gộp: {mergeDiff.run.title}</b><p>{mergeDiff.run.content_markdown}</p></div>{mergeDiff.sources.map((source,i)=><div key={i}><b>Nguồn {i+1}: {source.title}</b><p>{source.content_markdown}</p></div>)}</section>}</section>}
      {showImport && <div className="app-modal-backdrop" role="presentation" onMouseDown={() => !importing && setShowImport(false)}><section className="app-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-modal-title" onMouseDown={(event) => event.stopPropagation()}><small>NHẬP KHO KIẾN THỨC</small><h2 id="import-modal-title">Nhập dữ liệu hàng loạt</h2><p>Nhận CSV UTF-8 hoặc Excel (.xlsx), tối đa 200 bài / 5 MB. Chỉ nhận văn bản.</p><div className="import-modal-tools"><label className="file-picker">Chọn tệp CSV/XLSX<input autoFocus type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void previewImport(file); }} /></label><div className="import-template-help"><span>Chưa có tệp đúng định dạng?</span><a className="link-button" href="/api/knowledge/import/template?format=xlsx">Tải file mẫu Excel</a></div></div>{importPreview && <div className={importPreview.invalid ? "import-summary error" : "import-summary"}><b>{importFile?.name}</b><span>{importPreview.valid}/{importPreview.total} dòng hợp lệ{importPreview.invalid ? ` · ${importPreview.invalid} dòng cần sửa` : " · sẵn sàng import"}</span>{importPreview.invalid ? <ul>{importPreview.rows.filter((row) => row.errors.length).slice(0, 5).map((row) => <li key={row.rowNumber}>Dòng {row.rowNumber}: {row.errors.join(" ")}</li>)}</ul> : <button className="ops-button primary" disabled={importing} onClick={() => void applyImport()}>{importing ? "Đang import…" : `Import ${importPreview.valid} bài viết`}</button>}</div>}<div className="app-modal-actions"><button className="ops-button" disabled={importing} onClick={() => setShowImport(false)}>Đóng</button></div></section></div>}
      {showForm && (
        <section className="ops-panel review-form" ref={editorRef}>
          <label>
            {editingId ? "Chỉnh sửa bài viết" : "Thêm bài viết"}
            <small className="field-hint neutral">Sửa và xuất bản sẽ tạo lại các đoạn để Agent tra cứu; chỉ nhận văn bản.</small>
          </label>
          <label>
            Tiêu đề
            <input
              ref={editorTitleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Hướng dẫn cấu hình SSO"
            />
          </label>
          <label>
            Nội dung bài viết
            <small className="field-hint neutral">
              Chỉ nhập văn bản. Văn bản giúp Trợ lý tìm kiếm, trích dẫn và kiểm
              chứng thông tin chính xác hơn; hình ảnh và tệp đính kèm chưa được
              dùng để tạo câu trả lời.
            </small>
            <div
              className="editor-toolbar"
              aria-label="Công cụ soạn thảo văn bản"
            >
              <button
                type="button"
                onClick={() =>
                  setContent(
                    (value) => `${value}${value ? "\n\n" : ""}## Tiêu đề mục\n`,
                  )
                }
              >
                Tiêu đề
              </button>
              <button
                type="button"
                onClick={() => setContent((value) => `${value}**in đậm**`)}
              >
                In đậm
              </button>
              <button
                type="button"
                onClick={() =>
                  setContent(
                    (value) => `${value}${value ? "\n" : ""}- Mục danh sách\n`,
                  )
                }
              >
                Danh sách
              </button>
              <button
                type="button"
                onClick={() =>
                  setContent(
                    (value) =>
                      `${value}${value ? "\n" : ""}> Ghi chú quan trọng\n`,
                  )
                }
              >
                Ghi chú
              </button>
            </div>
            <textarea
              className="large-textarea"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Nhập nội dung đã được chuyên gia xác minh…"
            />
            <small
              className={
                content.length > contentLimit * 0.9
                  ? "field-hint warning"
                  : "field-hint"
              }
            >
              {content.length.toLocaleString("vi-VN")}/
              {contentLimit.toLocaleString("vi-VN")} ký tự · Ước tính{" "}
              {Math.ceil(
                content.trim().split(/\s+/).filter(Boolean).length / 260,
              ) || 0}{" "}
              đoạn để Trợ lý tra cứu
            </small>
            {!!chunkPreview.length && <details className="chunk-preview"><summary>Xem trước {chunkPreview.length} đoạn đầu Agent sẽ tra cứu</summary><ol>{chunkPreview.map((chunk) => <li key={chunk.index}>{chunk.content.slice(0, 220)}{chunk.content.length > 220 ? "…" : ""}</li>)}</ol></details>}
          </label>
          <div className="knowledge-metadata-grid">
            <label className="setting-switch compact">
              <input type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} />
              <span><b>Nguồn đã được xác minh</b><small>Chỉ nguồn đã xác minh mới được Trợ lý ưu tiên khi trả lời.</small></span>
            </label>
            <label>
              Mức ưu tiên nguồn
              <select value={sourcePriority} onChange={(e) => setSourcePriority(Number(e.target.value))}>
                <option value={80}>Cao — chính sách/quy trình chính thức</option>
                <option value={50}>Tiêu chuẩn — hướng dẫn vận hành</option>
                <option value={20}>Tham khảo — cần đối chiếu thêm</option>
              </select>
            </label>
            <label>
              Nhắc rà soát lại
              <input type="date" value={reviewDueAt} onChange={(e) => setReviewDueAt(e.target.value)} />
            </label>
            <label>
              Nhóm dịch vụ
              <input value={serviceGroup} onChange={(e) => setServiceGroup(e.target.value)} placeholder="Ví dụ: Cloud Server" />
            </label>
            <label>
              Cách Agent phản hồi
              <select value={responsePolicy} onChange={(e) => setResponsePolicy(e.target.value as typeof responsePolicy)}>
                <option value="grounded">Trả lời có căn cứ</option>
                <option value="partial">Trả lời một phần</option>
                <option value="escalate">Chuyển chuyên gia</option>
              </select>
            </label>
          </div>
          <div className="editor-actions">
            <button
              className="ops-button"
              disabled={
                title.length < 3 ||
                content.length < 20 ||
                content.length > contentLimit || !hasArticleChanges
              }
              onClick={() => void create("draft")}
            >
              Lưu bản nháp
            </button>
            <button
              className="ops-button primary"
              disabled={
                title.length < 3 ||
                content.length < 20 ||
                content.length > contentLimit || !hasArticleChanges
              }
              onClick={() => void create("published")}
            >
              Xuất bản
            </button>
            <button className="ops-button" onClick={() => { setShowForm(false); setEditingId(null); setEditSnapshot(null); }}>Đóng soạn thảo</button>
          </div>
        </section>
      )}
      <div className="ops-panel">
        <div className="knowledge-status-tabs"><button className={articleStatus === "published" ? "active" : ""} onClick={() => {setArticleStatus("published");setArticlePage(1)}}>Đang sử dụng</button><button className={articleStatus === "draft" ? "active" : ""} onClick={() => {setArticleStatus("draft");setArticlePage(1)}}>Bản nháp</button><button className={articleStatus === "archived" ? "active" : ""} onClick={() => {setArticleStatus("archived");setArticlePage(1)}}>Đã lưu trữ</button></div>
        <label className="knowledge-filter">
          <span>Tìm trong kho</span>
          <input value={articleFilter} onChange={(event) => setArticleFilter(event.target.value)} placeholder="Tiêu đề, nhóm dịch vụ hoặc trạng thái phản hồi…" />
        </label>
        <div className="article-list">
          {articles.filter((item) => `${item.title} ${item.service_group ?? ""} ${item.status} ${item.response_policy ?? ""}`.toLocaleLowerCase("vi-VN").includes(articleFilter.toLocaleLowerCase("vi-VN"))).length ? (
            articles.filter((item) => `${item.title} ${item.service_group ?? ""} ${item.status} ${item.response_policy ?? ""}`.toLocaleLowerCase("vi-VN").includes(articleFilter.toLocaleLowerCase("vi-VN"))).map((item) => (
              <div className="article-row" key={item.id}>
                <span className="doc-icon">
                  <NavigationIcon name="knowledge" />
                </span>
                <span>
                  <b>{item.title}</b>
                  <small>
                    {item.service_group ?? item.category ?? "Chưa phân loại"} · Cập nhật{" "}
                    {new Date(item.updated_at).toLocaleString("vi-VN")}
                    {item.is_verified ? " · Đã xác minh" : " · Chưa xác minh"}
                    {item.version ? ` · v${item.version}` : ""}
                    {item.source_file ? " · Nguồn import" : ""}
                  </small>
                </span>
                <span>{item.chunk_count} đoạn</span>
                <span className="info-pill">{item.response_policy === "escalate" ? "Chuyển chuyên gia" : item.response_policy === "partial" ? "Trả lời một phần" : "Có căn cứ"}</span>
                <span
                  className={
                    item.status === "published"
                      ? "success-pill"
                      : "warning-pill"
                  }
                >
                  {item.status === "published"
                    ? "Đã xuất bản"
                    : item.status === "draft"
                      ? "Bản nháp"
                      : "Đã lưu trữ"}
                </span>
                <span className="article-actions"><button className="link-button" onClick={() => void edit(item.id)}>Chỉnh sửa</button>{item.merge_status === "draft" ? <><button className="link-button" onClick={() => void decideMerge(item,"approve")}>Duyệt gộp</button><button className="link-button danger" onClick={() => void decideMerge(item,"reject")}>Từ chối</button></> : item.status === "published" && <button className="link-button" onClick={() => void suggestMerge(item)}>Gộp bài</button>}{item.status !== "archived" ? <button className="link-button danger" onClick={() => void archive(item.id)}>Lưu trữ</button> : <><button className="link-button" onClick={() => void restore(item)}>Khôi phục</button><button className="link-button danger" onClick={() => void purge(item)}>Xóa vĩnh viễn</button></>}</span>
              </div>
            ))
          ) : (
            <div className="ops-empty">
              Chưa có bài viết. Hãy thêm tài liệu đã được xác minh.
            </div>
          )}
        </div>
        {articleTotal>20&&<div className="pagination"><button className="ops-button" disabled={articlePage===1} onClick={()=>setArticlePage(p=>p-1)}>← Trước</button><span>Trang {articlePage} / {Math.ceil(articleTotal/20)}</span><button className="ops-button" disabled={articlePage>=Math.ceil(articleTotal/20)} onClick={()=>setArticlePage(p=>p+1)}>Sau →</button></div>}
      </div>
    </Shell>
  );
}

function QueueScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [query, setQuery] = useState("");
  const load = async () => {
    const response = await fetch("/api/unanswered");
    const body = await response.json().catch(() => ({}));
    if (response.ok) setTickets(body.questions ?? []);
  };
  useEffect(() => {
    void load();
  }, []);
  const visible = tickets.filter((item) =>
    item.original_question.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Shell screen="queue">
      <Header
        screen="queue"
        title="Hàng đợi chưa trả lời"
        description="Các câu hỏi thiếu tài liệu hoặc chưa đạt mức độ tin cậy yêu cầu."
        action={
          <button className="ops-button" onClick={() => void load()}>
            ↻ Làm mới
          </button>
        }
      />
      <div className="ops-panel">
        <div className="ops-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm câu hỏi…"
          />
        </div>
        <div className="ops-table">
          <table>
            <thead>
              <tr>
                <th>Câu hỏi</th>
                <th>Độ tin cậy</th>
                <th>Nguyên nhân</th>
                <th>Người tạo</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.original_question}</b>
                      <small>
                        {new Date(item.created_at).toLocaleString("vi-VN")}
                      </small>
                    </td>
                    <td className="warning-text">
                      {Math.round((item.retrieval_score ?? 0) * 100)}%
                    </td>
                    <td>
                      {item.reason_code === "missing_knowledge"
                        ? "Thiếu tài liệu"
                        : item.reason_code === "expert_required"
                          ? "Cần chuyên gia xác nhận"
                          : item.reason_code === "expert_requested"
                            ? "Được yêu cầu hỗ trợ thêm"
                            : "Độ tin cậy thấp"}
                    </td>
                    <td>{item.creator}</td>
                    <td>
                      <span className="warning-pill">
                        {item.status === "new" ? "Mới" : item.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => router.push(`/review?id=${item.id}`)}
                      >
                        Rà soát →
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>Không có câu hỏi cần xử lý.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

function ReviewScreen() {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [answer, setAnswer] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id"));
  }, []);
  useEffect(() => {
    if (!id) return;
    void fetch("/api/unanswered")
      .then((r) => r.json())
      .then((b) =>
        setTicket(
          (b.questions ?? []).find((item: Ticket) => item.id === id) ?? null,
        ),
      );
  }, [id]);
  const publish = async () => {
    if (!id || !answer || !title) return;
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const response = await fetch(`/api/unanswered/${id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draftAnswer: answer,
        finalAnswer: answer,
        publish: true,
        title,
        slug,
      }),
    });
    if (response.ok) {
      setMessage("Đã xuất bản câu trả lời thành bài viết và đóng hàng đợi.");
      setTimeout(() => router.push("/unanswered"), 900);
    } else
      setMessage(
        "Không thể xuất bản. Hãy kiểm tra thông tin và quyền thao tác.",
      );
  };
  return (
    <Shell screen="review">
      <Header
        screen="review"
        title="Rà soát kỹ thuật"
        description="Chuyển câu hỏi chưa có căn cứ thành bài viết đã được phê duyệt."
      />
      <Message value={message} />
      {!id ? (
        <div className="ops-panel ops-empty">
          Hãy mở một phiếu từ Hàng đợi chưa trả lời.
        </div>
      ) : !ticket ? (
        <div className="ops-panel ops-empty">
          Đang tải phiếu hoặc phiếu không tồn tại.
        </div>
      ) : (
        <div className="review-layout">
          <section className="ops-panel">
            <span className="warning-pill">Cần rà soát</span>
            <h2>{ticket.original_question}</h2>
            <div className="diagnostic">
              <b>Lý do trợ lý chưa trả lời</b>
              <span>
                {ticket.reason_code === "missing_knowledge"
                  ? "Chưa có bài viết phù hợp trong kho kiến thức."
                  : ticket.reason_code === "expert_required"
                    ? "Nguồn yêu cầu chuyên gia xác nhận trước khi tư vấn chi tiết."
                    : ticket.reason_code === "expert_requested"
                      ? "Người dùng cần chuyên gia hỗ trợ thêm cho câu trả lời này."
                      : `Độ tin cậy ${Math.round((ticket.retrieval_score ?? 0) * 100)}% chưa đạt ngưỡng trả lời tự động.`}
              </span>
            </div>
          </section>
          <section className="ops-panel review-form">
            <label>
              Tiêu đề bài viết
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Tiêu đề tài liệu mới"
              />
            </label>
            <label>
              Câu trả lời đã phê duyệt
              <textarea
                className="large-textarea"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Viết câu trả lời đã được chuyên gia xác nhận…"
              />
            </label>
            <button
              className="ops-button primary"
              disabled={title.length < 3 || answer.length < 20}
              onClick={() => void publish()}
            >
              Xuất bản & đóng phiếu
            </button>
          </section>
        </div>
      )}
    </Shell>
  );
}

function ProfileScreen() {
  const { notify } = useFeedback();
  const [profile, setProfile] = useState<{ fullName: string; username: string; email: string; roleLabel: string; avatarUrl: string | null; mfaEnabled: boolean } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [mfaDialog, setMfaDialog] = useState<"setup" | "disable" | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ qrCodeDataUrl: string; uri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaSaving, setMfaSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void fetch("/api/profile").then((response) => response.ok ? response.json() : null).then((body) => setProfile(body?.profile ?? null)); }, []);
  const rules = passwordChecklist(password);
  const readyForStrength = Object.values(rules).every(Boolean);
  const strength = passwordStrength(password);
  const passwordMatches = passwordConfirmation.length > 0 && password === passwordConfirmation;
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    const form = new FormData(); form.append("file", file);
    setAvatarSaving(true);
    const response = await fetch("/api/profile/avatar", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    setAvatarSaving(false);
    if (!response.ok) { notify(readableApiError(body.error, "Không thể cập nhật ảnh đại diện."), "error"); return; }
    setProfile((current) => current ? { ...current, avatarUrl: `${body.avatarUrl}?v=${Date.now()}` } : current);
    window.dispatchEvent(new Event("profile-avatar-updated"));
    notify("Đã cập nhật ảnh đại diện.", "success");
  };
  const removeAvatar = async () => {
    setAvatarSaving(true);
    const response = await fetch("/api/profile/avatar", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setAvatarSaving(false);
    if (!response.ok) { notify(readableApiError(body.error, "Không thể xóa ảnh đại diện."), "error"); return; }
    setProfile((current) => current ? { ...current, avatarUrl: null } : current);
    window.dispatchEvent(new Event("profile-avatar-updated"));
    notify("Đã xóa ảnh đại diện.", "success");
  };
  const changePassword = async () => {
    setCurrentPasswordError("");
    setSaving(true);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, password, passwordConfirmation }) });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      const errorMessage = readableApiError(body.error, "Không thể đổi mật khẩu.");
      if (errorMessage === "Mật khẩu hiện tại không đúng.") { setCurrentPasswordError(errorMessage); return; }
      notify(errorMessage, "error");
      return;
    }
    setCurrentPassword(""); setPassword(""); setPasswordConfirmation(""); notify("Đã đổi mật khẩu. Vui lòng đăng nhập lại trên các thiết bị khác.", "success");
  };
  const beginMfa = async () => { setMfaSaving(true); const response = await fetch("/api/profile/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setup" }) }); const body = await response.json().catch(() => ({})); setMfaSaving(false); if (!response.ok) { notify(readableApiError(body.error, "Không thể bắt đầu thiết lập 2FA."), "error"); return; } setMfaSetup(body); setMfaCode(""); setMfaDialog("setup"); };
  const verifyMfa = async () => { setMfaSaving(true); const response = await fetch("/api/profile/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "verify", code: mfaCode }) }); const body = await response.json().catch(() => ({})); setMfaSaving(false); if (!response.ok) { notify(readableApiError(body.error, "Không thể bật 2FA."), "error"); return; } setProfile((current) => current ? { ...current, mfaEnabled: true } : current); setMfaDialog(null); setMfaSetup(null); notify("Đã bật xác thực hai bước.", "success"); };
  const disableMfa = async () => { setMfaSaving(true); const response = await fetch("/api/profile/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "disable", currentPassword: mfaPassword }) }); const body = await response.json().catch(() => ({})); setMfaSaving(false); if (!response.ok) { notify(readableApiError(body.error, "Không thể tắt 2FA."), "error"); return; } setProfile((current) => current ? { ...current, mfaEnabled: false } : current); setMfaPassword(""); setMfaDialog(null); notify("Đã tắt xác thực hai bước.", "success"); };
  return <Shell screen="profile"><Header screen="profile" title="Thông tin người dùng" description="Quản lý mật khẩu, ảnh đại diện và bảo mật tài khoản của bạn." />
    <section className="ops-panel profile-workspace">
      <div className="profile-summary"><button className="profile-avatar-trigger" type="button" aria-label="Thay đổi ảnh đại diện" onClick={() => setAvatarDialogOpen(true)}><UserAvatar className="profile-avatar-large" fullName={profile?.fullName} src={profile?.avatarUrl} alt="Ảnh đại diện hiện tại" /><span aria-hidden="true">Chỉnh sửa</span></button><div><h2>{profile?.fullName ?? "Đang tải thông tin…"}</h2><p>{profile?.roleLabel ?? ""}</p></div></div>
      <div className="profile-readonly-grid"><label>Họ và tên<input value={profile?.fullName ?? ""} readOnly /></label><label>Tên đăng nhập<input value={profile?.username ?? ""} readOnly /></label><label>Email<input value={profile?.email ?? ""} readOnly /></label><label>Vai trò<input value={profile?.roleLabel ?? ""} readOnly /></label></div>
      <section className="profile-password-section"><div><h2>Đổi mật khẩu</h2><p>Trước tiên xác thực mật khẩu hiện tại, sau đó đặt mật khẩu mới theo checklist.</p></div><div className="password-current-group"><h3>1. Xác thực hiện tại</h3><label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setCurrentPasswordError(""); }} /><small className={`field-feedback ${currentPasswordError ? "field-invalid" : "field-placeholder"}`} aria-live="polite">{currentPasswordError || "Trạng thái xác thực"}</small></label></div><div className="password-new-group"><h3>2. Đặt mật khẩu mới</h3><div className="profile-password-grid"><label>Mật khẩu mới<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><small className="field-feedback field-placeholder" aria-hidden="true">Trạng thái xác nhận</small></label><label>Nhập lại mật khẩu mới<input type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /><small className={`field-feedback ${passwordConfirmation ? (passwordMatches ? "field-valid" : "field-invalid") : "field-placeholder"}`} aria-live="polite">{passwordConfirmation ? (passwordMatches ? "✓ Mật khẩu trùng khớp" : "Mật khẩu chưa trùng khớp") : "Trạng thái xác nhận"}</small></label></div><ul className="password-checklist" aria-label="Điều kiện mật khẩu">{[[rules.minimumLength, "Ít nhất 8 ký tự"], [rules.uppercase, "Có ký tự IN HOA"], [rules.lowercase, "Có ký tự thường"], [rules.specialCharacter, "Có ký tự đặc biệt như @, #, !, %"]].map(([passed, label]) => <li className={passed ? "passed" : ""} key={String(label)}><span>{passed ? "✓" : "○"}</span>{label}</li>)}</ul>{readyForStrength && <small className={`password-strength ${strength === "strong" ? "strong" : "medium"}`}>Độ mạnh: {strength === "strong" ? "Mạnh" : "Trung bình"}</small>}</div><div className="editor-actions"><button className="ops-button primary" disabled={saving || !currentPassword || !readyForStrength || !passwordMatches} onClick={() => void changePassword()}>{saving ? "Đang áp dụng…" : "Áp dụng mật khẩu mới"}</button></div></section>
      <section className="profile-security-row"><div><h2>Xác thực hai bước</h2><p>{profile?.mfaEnabled ? "Đang bật bằng ứng dụng xác thực." : "Tự nguyện ở giai đoạn hiện tại; bật để bảo vệ tài khoản tốt hơn."}</p></div><div className="profile-mfa-action"><span className={profile?.mfaEnabled ? "success-pill" : "info-pill"}>{profile?.mfaEnabled ? "Đang bật" : "Chưa bật"}</span><button type="button" role="switch" aria-checked={Boolean(profile?.mfaEnabled)} className={`setting-toggle ${profile?.mfaEnabled ? "enabled" : ""}`} disabled={mfaSaving} onClick={() => profile?.mfaEnabled ? setMfaDialog("disable") : void beginMfa()}><span aria-hidden="true" /></button></div></section>
    </section>
    {avatarDialogOpen && <div className="app-modal-backdrop" role="presentation" onMouseDown={() => !avatarSaving && setAvatarDialogOpen(false)}><section className="app-modal avatar-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-modal-title" onMouseDown={(event) => event.stopPropagation()}><small>ẢNH ĐẠI DIỆN</small><h2 id="avatar-modal-title">Cập nhật ảnh đại diện</h2><p>Ảnh được cắt vuông, chuẩn hóa và lưu riêng cho tài khoản của bạn.</p><div className="avatar-modal-content"><UserAvatar className="avatar-modal-preview" fullName={profile?.fullName} src={profile?.avatarUrl} alt="Xem trước ảnh đại diện" /><div className="avatar-dropzone" role="button" tabIndex={0} aria-describedby="avatar-upload-help" onClick={() => avatarInputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); avatarInputRef.current?.click(); } }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void uploadAvatar(event.dataTransfer.files[0]); }}><strong>{avatarSaving ? "Đang xử lý ảnh…" : "Kéo thả ảnh vào đây hoặc chọn tệp"}</strong><span id="avatar-upload-help">JPG, PNG hoặc WebP · tối đa 5 MB</span></div></div><input ref={avatarInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.currentTarget.value = ""; }} /><div className="app-modal-actions"><button className="ops-button" type="button" disabled={avatarSaving} onClick={() => setAvatarDialogOpen(false)}>Đóng</button>{profile?.avatarUrl && <button className="ops-button danger" type="button" disabled={avatarSaving} onClick={() => void removeAvatar()}>Xóa ảnh</button>}</div></section></div>}
    {mfaDialog === "setup" && <div className="app-modal-backdrop"><section className="app-modal mfa-modal" role="dialog" aria-modal="true" aria-labelledby="mfa-setup-title"><small>XÁC THỰC HAI BƯỚC</small><h2 id="mfa-setup-title">Quét mã bằng ứng dụng xác thực</h2><p>Quét mã QR bằng Google Authenticator, Microsoft Authenticator hoặc ứng dụng tương thích; sau đó nhập mã 6 số để hoàn tất.</p>{mfaSetup?.qrCodeDataUrl && <img className="mfa-qr" src={mfaSetup.qrCodeDataUrl} alt="Mã QR thiết lập xác thực hai bước" />}<label>Mã xác thực 6 số<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} /></label><div className="app-modal-actions"><button className="ops-button" disabled={mfaSaving} onClick={() => { setMfaDialog(null); setMfaSetup(null); }}>Hủy</button><button className="ops-button primary" disabled={mfaSaving || mfaCode.length !== 6} onClick={() => void verifyMfa()}>{mfaSaving ? "Đang xác minh…" : "Bật xác thực hai bước"}</button></div></section></div>}
    {mfaDialog === "disable" && <div className="app-modal-backdrop"><section className="app-modal" role="dialog" aria-modal="true" aria-labelledby="mfa-disable-title"><small>XÁC NHẬN BẢO MẬT</small><h2 id="mfa-disable-title">Tắt xác thực hai bước?</h2><p>Nhập mật khẩu hiện tại để xác nhận. Bạn có thể bật lại bất cứ lúc nào.</p><label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" value={mfaPassword} onChange={(event) => setMfaPassword(event.target.value)} /></label><div className="app-modal-actions"><button className="ops-button" disabled={mfaSaving} onClick={() => { setMfaDialog(null); setMfaPassword(""); }}>Hủy</button><button className="ops-button danger" disabled={mfaSaving || !mfaPassword} onClick={() => void disableMfa()}>{mfaSaving ? "Đang tắt…" : "Tắt 2FA"}</button></div></section></div>}
  </Shell>;
}

type ManagedUser = { id: string; fullName: string; username: string; email: string; role: "sales" | "technical" | "admin"; roleLabel: string; status: string; purgeAfter: string | null };

function UserManagementSettings() {
  const { notify, confirm } = useFeedback();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "", passwordConfirmation: "", role: "sales" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    return fetch("/api/users?" + params.toString()).then(async (response) => response.ok ? response.json() : Promise.reject()).then((body) => { setUsers(body.users ?? []); setPagination(body.pagination ?? { page: 1, pageSize: 20, total: 0 }); }).catch(() => notify("Không thể tải danh sách người dùng.", "error")).finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, [page, search, roleFilter, statusFilter]);
  const createUser = async () => { setSaving(true); const response = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) }); const body = await response.json().catch(() => ({})); setSaving(false); if (!response.ok) { notify(readableApiError(body.error, "Không thể tạo người dùng."), "error"); return; } setForm({ fullName: "", username: "", email: "", password: "", passwordConfirmation: "", role: "sales" }); setFormOpen(false); notify("Đã tạo người dùng mới.", "success"); load(); };
  const updateUser = async () => { if (!editingId) return; setSaving(true); const response = await fetch(`/api/users/${editingId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(form) }); const body = await response.json().catch(() => ({})); setSaving(false); if (!response.ok) { notify(readableApiError(body.error, "Không thể điều chỉnh người dùng."), "error"); return; } setFormOpen(false); setEditingId(null); setForm({ fullName: "", username: "", email: "", password: "", passwordConfirmation: "", role: "sales" }); notify("Đã điều chỉnh người dùng.", "success"); load(); };
  const disableUser = async (user: ManagedUser) => { const candidates = users.filter((candidate) => candidate.status === "active" && candidate.id !== user.id); const transferee = candidates[0]; if (!transferee) { notify("Cần còn ít nhất một tài khoản đang hoạt động khác để nhận bài viết.", "error"); return; } if (!await confirm({ title: `Vô hiệu hóa ${user.fullName}?`, description: `Bài viết sẽ được chuyển cho ${transferee.fullName}; tài khoản có thể khôi phục trong 30 ngày trước khi dữ liệu định danh được làm sạch.`, confirmLabel: "Vô hiệu hóa", tone: "danger" })) return; const response = await fetch(`/api/users/${user.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ transferToUserId: transferee.id, ticketAssigneeId: candidates.find((candidate) => candidate.role !== "sales")?.id ?? transferee.id }) }); const body = await response.json().catch(() => ({})); if (!response.ok) { notify(readableApiError(body.error, "Không thể vô hiệu hóa người dùng."), "error"); return; } notify("Đã vô hiệu hóa tài khoản và chuyển dữ liệu liên quan.", "success"); load(); };
  const newUserPasswordRules = passwordChecklist(form.password);
  const newUserPasswordReady = Object.values(newUserPasswordRules).every(Boolean);
  const newUserPasswordsMatch = form.passwordConfirmation.length > 0 && form.password === form.passwordConfirmation;
  const newUserPasswordStrength = passwordStrength(form.password);
  return <section className="settings-user-management">{formOpen && <div className="app-modal-backdrop" role="presentation"><section className="app-modal user-form-modal" role="dialog" aria-modal="true" aria-labelledby="user-form-title"><div className="panel-heading"><div><h2 id="user-form-title">{editingId ? "Điều chỉnh người dùng" : "Tạo người dùng mới"}</h2><p>{editingId ? "Cập nhật thông tin và vai trò của tài khoản." : "Mật khẩu cần tối thiểu 8 ký tự, có chữ hoa, chữ thường và ký tự đặc biệt."}</p></div>{editingId && <button className="ops-button" onClick={() => { setEditingId(null); setForm({ fullName: "", username: "", email: "", password: "", passwordConfirmation: "", role: "sales" }); }}>Hủy</button>}</div><section className="user-account-group"><h3>Thông tin tài khoản</h3><div className="user-form-grid"><label>Họ và tên<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label><label>Tên đăng nhập<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Vai trò<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="sales">Người dùng</option><option value="technical">Chuyên gia</option><option value="admin">Quản trị viên</option></select></label></div></section>{!editingId && <><section className="password-new-group user-password-group"><h3>Thiết lập mật khẩu</h3><div className="profile-password-grid"><label>Mật khẩu<input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><small className="field-feedback field-placeholder" aria-hidden="true">Trạng thái xác nhận</small></label><label>Nhập lại mật khẩu<input type="password" autoComplete="new-password" value={form.passwordConfirmation} onChange={(e) => setForm({ ...form, passwordConfirmation: e.target.value })} /><small className={`field-feedback ${form.passwordConfirmation ? (newUserPasswordsMatch ? "field-valid" : "field-invalid") : "field-placeholder"}`} aria-live="polite">{form.passwordConfirmation ? (newUserPasswordsMatch ? "✓ Mật khẩu trùng khớp" : "Mật khẩu chưa trùng khớp") : "Trạng thái xác nhận"}</small></label></div><ul className="password-checklist user-password-checklist" aria-label="Điều kiện mật khẩu">{[[newUserPasswordRules.minimumLength, "Ít nhất 8 ký tự"], [newUserPasswordRules.uppercase, "Có ký tự IN HOA"], [newUserPasswordRules.lowercase, "Có ký tự thường"], [newUserPasswordRules.specialCharacter, "Có ký tự đặc biệt như @, #, !, %"]].map(([passed, label]) => <li className={passed ? "passed" : ""} key={String(label)}><span>{passed ? "✓" : "○"}</span>{label}</li>)}</ul>{newUserPasswordReady && <small className={`password-strength ${newUserPasswordStrength === "strong" ? "strong" : "medium"}`}>Độ mạnh: {newUserPasswordStrength === "strong" ? "Mạnh" : "Trung bình"}</small>}</section></>}<div className="editor-actions"><button className="ops-button" disabled={saving} onClick={() => { setFormOpen(false); setEditingId(null); setForm({ fullName: "", username: "", email: "", password: "", passwordConfirmation: "", role: "sales" }); }}>Hủy</button><button className="ops-button primary" disabled={saving || (!editingId && (!newUserPasswordReady || !newUserPasswordsMatch))} onClick={() => void (editingId ? updateUser() : createUser())}>{saving ? "Đang lưu…" : editingId ? "Lưu điều chỉnh" : "Tạo người dùng"}</button></div></section></div>}<section className="ops-panel ops-table user-management-list"><div className="panel-heading"><div><h2>Danh sách người dùng</h2><p>{loading ? "Đang tải…" : `${pagination.total} tài khoản phù hợp.`}</p></div><button className="ops-button primary" onClick={() => { setEditingId(null); setForm({ fullName: "", username: "", email: "", password: "", passwordConfirmation: "", role: "sales" }); setFormOpen(true); }}>+ Tạo người dùng</button></div><div className="user-management-toolbar"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm tên, email hoặc tên đăng nhập" aria-label="Tìm người dùng" /><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} aria-label="Lọc theo vai trò"><option value="">Tất cả vai trò</option><option value="admin">Quản trị viên</option><option value="technical">Chuyên gia</option><option value="sales">Người dùng</option></select><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Lọc theo trạng thái"><option value="">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="disabled">Đã vô hiệu hóa</option><option value="purged">Đã làm sạch</option></select></div><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Vòng đời</th><th>Tác vụ</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.fullName}</strong><small>{user.username} · {user.email}</small></td><td>{user.roleLabel}</td><td><span className={user.status === "active" ? "success-pill" : "warning-pill"}>{user.status === "active" ? "Đang hoạt động" : user.status === "disabled" ? "Đã vô hiệu hóa" : "Đã làm sạch"}</span></td><td>{user.purgeAfter ? `Làm sạch sau ${new Date(user.purgeAfter).toLocaleDateString("vi-VN")}` : "—"}</td><td>{user.status === "active" && <><button className="link-button" onClick={() => { setEditingId(user.id); setForm({ fullName: user.fullName, username: user.username, email: user.email, password: "", passwordConfirmation: "", role: user.role }); setFormOpen(true); }}>Điều chỉnh</button><button className="link-button danger" onClick={() => void disableUser(user)}>Vô hiệu hóa</button></>}</td></tr>)}</tbody></table>{pagination.total > pagination.pageSize && <div className="pagination"><button className="ops-button" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}>← Trước</button><span>Trang {page} / {Math.ceil(pagination.total / pagination.pageSize)}</span><button className="ops-button" disabled={page >= Math.ceil(pagination.total / pagination.pageSize) || loading} onClick={() => setPage((value) => value + 1)}>Sau →</button></div>}</section></section>;
}

function SettingsScreen() {
  const [message, setMessage] = useState("");
  const [settingsTab, setSettingsTab] = useState<
    "agent" | "retrieval" | "providers" | "users"
  >("retrieval");
  const [retrieval, setRetrieval] = useState({
    topK: 10,
    maxArticles: 3,
    keywordWeight: 0.4,
    semanticWeight: 0.6,
    diversityWeight: 0.3,
    autoAnswerThreshold: 0.8,
    partialAnswerThreshold: 0.6,
    sensitiveThreshold: 0.9,
    sensitiveTopics: ["Giá & báo giá", "Hợp đồng", "Bảo mật", "SLA"],
    verifiedOnly: true,
    excludeReplaced: true,
    shadowMode: false,
    mergePrefilterThreshold: 0.4,
    mergeSuggestionThreshold: 0.78,
    mergeUniqueCoverageThreshold: 0.25,
    mergeSynonyms: ["record = bản ghi", "txt record = bản ghi txt"],
  });
  const [retrievalSaving, setRetrievalSaving] = useState(false);
  const [profileName, setProfileName] = useState("Trợ lý phản hồi");
  const [profileRole, setProfileRole] = useState(
    "Chuyên viên tư vấn nội bộ lịch sự và trung thực",
  );
  const [profileTone, setProfileTone] = useState("professional");
  const [profileLength, setProfileLength] = useState("balanced");
  const [profileFallback, setProfileFallback] = useState("supportive");
  const [profileInstructions, setProfileInstructions] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [name, setName] = useState("Google Gemini");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<Array<{ id: string; label: string }>>(
    [],
  );
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [lastChecked, setLastChecked] = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [azureKey, setAzureKey] = useState("");
  const [azureDeployment, setAzureDeployment] = useState("");
  const [azureModel, setAzureModel] = useState("gpt-4o-mini");
  const [azureVersion, setAzureVersion] = useState("2024-06-01");
  const [azureModels, setAzureModels] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [azureChecking, setAzureChecking] = useState(false);
  const [azureVerified, setAzureVerified] = useState(false);
  const [azureDeploymentVerified, setAzureDeploymentVerified] = useState(false);
  const [azureConfigured, setAzureConfigured] = useState(false);
  const [azureSaving, setAzureSaving] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void fetch("/api/providers")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!isCurrent) return;
        const providers = body?.providers ?? [];
        const provider = providers.find(
          (item: { provider_type?: string; is_enabled?: boolean }) =>
            item.provider_type === "gemini" && item.is_enabled,
        );
        if (provider) {
          setName(provider.display_name ?? "Google Gemini");
          setModel(provider.model ?? "");
          setConfigured(true);
        }
        const azureProvider = providers.find(
          (item: { provider_type?: string }) =>
            item.provider_type === "azure_openai",
        );
        if (azureProvider) {
          setAzureEndpoint(azureProvider.endpoint ?? "");
          setAzureDeployment(azureProvider.deployment ?? "");
          setAzureModel(azureProvider.model ?? "");
          setAzureVersion(azureProvider.api_version ?? "");
          setAzureConfigured(true);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    void fetch("/api/retrieval/settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body?.settings && setRetrieval(body.settings))
      .catch(() => undefined);
  }, []);
  const saveRetrieval = async () => {
    setRetrievalSaving(true);
    try {
      const response = await fetch("/api/retrieval/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(retrieval),
      });
      const body = await response.json().catch(() => ({}));
      setMessage(
        response.ok
          ? "Đã lưu cấu hình Tri thức & tìm kiếm."
          : readableApiError(
              body.error,
              "Không thể lưu cấu hình Tri thức & tìm kiếm.",
            ),
      );
    } catch {
      setMessage("Không thể kết nối để lưu cấu hình Tri thức & tìm kiếm.");
    } finally {
      setRetrievalSaving(false);
    }
  };

  useEffect(() => {
    void fetch("/api/assistant/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const profile = body?.profile;
        if (!profile) return;
        setProfileName(profile.name);
        setProfileRole(profile.roleDescription);
        setProfileTone(profile.tone);
        setProfileLength(profile.responseLength);
        setProfileFallback(profile.fallbackStyle);
        setProfileInstructions(profile.customInstructions);
      })
      .catch(() => undefined);
  }, []);
  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      const response = await fetch("/api/assistant/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          roleDescription: profileRole,
          tone: profileTone,
          responseLength: profileLength,
          fallbackStyle: profileFallback,
          customInstructions: profileInstructions,
        }),
      });
      const body = await response.json().catch(() => ({}));
      setMessage(
        response.ok
          ? "Đã lưu tính cách của Trợ lý."
          : readableApiError(body.error, "Không thể lưu tính cách Trợ lý."),
      );
    } catch {
      setMessage("Không thể kết nối để lưu tính cách Trợ lý.");
    } finally {
      setProfileSaving(false);
    }
  };

  const verify = async () => {
    if (!key.trim()) {
      setMessage("Nhập API key trước khi kiểm tra.");
      return;
    }
    setChecking(true);
    setVerified(false);
    setModels([]);
    setModel("");
    setMessage("");
    const response = await fetch("/api/providers/gemini/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    });
    const body = await response.json().catch(() => ({}));
    setChecking(false);
    if (!response.ok) {
      setMessage(body.error ?? "Không thể kiểm tra API key.");
      return;
    }
    setModels(body.models ?? []);
    setVerified(true);
    setLastChecked(new Date().toLocaleString("vi-VN"));
    setMessage("Kết nối Gemini thành công. Hãy chọn model để tiếp tục.");
  };
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: "gemini",
          displayName: name,
          apiKey: key,
          model,
          isEnabled: true,
          isDefault: true,
        }),
      });
      if (!response.ok) throw new Error();
      setConfigured(true);
      setKey("");
      setVerified(false);
      setModels([]);
      setLastChecked("");
      setMessage(
        "Đã lưu cấu hình nhà cung cấp AI. Khóa chỉ được mã hóa ở máy chủ.",
      );
    } catch {
      setMessage(
        "Không thể lưu cấu hình. Hãy kiểm tra quyền quản trị và API key.",
      );
    } finally {
      setSaving(false);
    }
  };
  const resetAzureVerification = () => {
    setAzureVerified(false);
    setAzureDeploymentVerified(false);
    setAzureModels([]);
  };
  const verifyAzure = async () => {
    if (!azureEndpoint.trim() || !azureKey.trim()) {
      setMessage("Nhập endpoint và API key Azure trước khi kiểm tra.");
      return;
    }
    setAzureChecking(true);
    resetAzureVerification();
    setMessage("");
    try {
      const response = await fetch("/api/providers/azure/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: azureEndpoint,
          apiKey: azureKey,
          deployment: azureDeployment.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      setAzureVersion(body.apiVersion ?? "");
      setAzureModels(body.models ?? []);
      setAzureModel((current) =>
        body.models?.some((item: { id: string }) => item.id === current)
          ? current
          : (body.models?.[0]?.id ?? ""),
      );
      setAzureVerified(true);
      setAzureDeploymentVerified(Boolean(body.deploymentVerified));
      setMessage(
        body.deploymentVerified
          ? "Đã xác thực endpoint, API key và deployment Azure OpenAI."
          : "Đã kết nối Azure OpenAI. Nhập deployment rồi kiểm tra lại để xác thực deployment trước khi lưu.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "Không thể kiểm tra kết nối Azure OpenAI.",
      );
    } finally {
      setAzureChecking(false);
    }
  };
  const saveAzure = async () => {
    setAzureSaving(true);
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: "azure_openai",
          displayName: "Azure OpenAI",
          endpoint: azureEndpoint,
          apiKey: azureKey,
          deployment: azureDeployment,
          model: azureModel,
          apiVersion: azureVersion,
          isEnabled: true,
          isDefault: true,
        }),
      });
      if (!response.ok) throw new Error();
      setAzureConfigured(true);
      setAzureKey("");
      resetAzureVerification();
      setMessage(
        "Đã lưu cấu hình Azure OpenAI. Agent Gemini đã được chuyển sang trạng thái không hoạt động.",
      );
    } catch {
      setMessage(
        "Không thể lưu cấu hình Azure OpenAI. Hãy kiểm tra thông tin và quyền quản trị.",
      );
    } finally {
      setAzureSaving(false);
    }
  };
  return (
    <Shell screen="settings">
      <Header
        screen="settings"
        title="Cài đặt hệ thống"
        description="Quản lý nhà cung cấp AI và cấu hình vận hành."
      />
      <Message value={message} className="settings-message" />
      <section className="settings-tabs" aria-label="Nhóm cấu hình quản trị">
        {[
          ["agent", "Cấu hình Agent"],
          ["retrieval", "Tri thức & tìm kiếm"],
          ["providers", "Nhà cung cấp AI"],
          ["users", "Quản trị người dùng"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={settingsTab === id ? "active" : ""}
            onClick={() => setSettingsTab(id as typeof settingsTab)}
          >
            {label}
          </button>
        ))}
      </section>
      <section className="settings-content">
      {settingsTab === "providers" && (
        <div className="provider-cards-grid">
          <section className="ops-panel provider-card provider-verification-card">
            <div className="provider-title">
              <span className="provider-logo">G</span>
              <div>
                <b>Google Gemini</b>
                <small>Nhà cung cấp mặc định</small>
              </div>
              {configured && <span className="success-pill">Đã lưu</span>}
            </div>
            <div className="security-note">
              API key được mã hóa ở máy chủ và không được trả về trình duyệt.
            </div>
            <label>
              Tên hiển thị
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Mô hình
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={!verified || checking}
              >
                <option value="">
                  {checking
                    ? "Đang tải model…"
                    : verified
                      ? "Chọn model được phép"
                      : "Chưa có model khả dụng"}
                </option>
                {!verified && model && <option value={model}>{model}</option>}
                {models.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              {verified && (
                <small className="field-hint">
                  {models.length} model khả dụng với API key này
                </small>
              )}
            </label>
            <label className="api-key-field">
              API key
              <input
                type="password"
                value={key}
                onChange={(event) => {
                  setKey(event.target.value);
                  setVerified(false);
                  setModels([]);
                  setModel("");
                  setLastChecked("");
                }}
                placeholder={
                  configured
                    ? "Khóa đã lưu an toàn — nhập khóa mới để thay thế"
                    : "Nhập API key mới"
                }
              />
            </label>
            <div className="provider-verification-action">
              <button
                className="ops-button"
                disabled={checking || !key.trim()}
                onClick={() => void verify()}
              >
                {checking
                  ? "Đang kiểm tra kết nối…"
                  : verified
                    ? "Kiểm tra lại"
                    : "Kiểm tra API key"}
              </button>
              {verified ? (
                <span className="success-pill">
                  Kết nối thành công · {lastChecked}
                </span>
              ) : (
                <span className="verification-hint">
                  Model chỉ mở sau khi API key được xác thực.
                </span>
              )}
            </div>
            <button
              className="ops-button primary"
              disabled={!verified || !model || saving}
              onClick={() => void save()}
            >
              {saving ? "Đang lưu cấu hình…" : "Lưu cấu hình"}
            </button>
          </section>
          <section className="ops-panel provider-card provider-verification-card azure-provider-card">
            <div className="provider-title">
              <span className="provider-logo azure">A</span>
              <div>
                <b>Azure OpenAI</b>
                <small>Agent dự phòng có thể cấu hình độc lập</small>
              </div>
              <span className={azureConfigured ? "success-pill" : "info-pill"}>
                {azureConfigured ? "Đã lưu" : "Chưa xác thực"}
              </span>
            </div>
            <div className="security-note">
              Endpoint và API key được mã hóa ở máy chủ; chỉ một Agent được phép
              hoạt động tại một thời điểm.
            </div>
            <label>
              Azure OpenAI endpoint
              <input
                value={azureEndpoint}
                onChange={(event) => {
                  setAzureEndpoint(event.target.value);
                  resetAzureVerification();
                }}
                placeholder="https://ten-tai-nguyen.openai.azure.com"
              />
            </label>
            <label>
              Azure OpenAI API key
              <input
                type="password"
                value={azureKey}
                onChange={(event) => {
                  setAzureKey(event.target.value);
                  resetAzureVerification();
                }}
                placeholder={
                  azureConfigured
                    ? "Khóa đã lưu an toàn — nhập khóa mới để thay thế"
                    : "Nhập Azure OpenAI API key"
                }
              />
            </label>
            <div className="provider-verification-action">
              <button
                className="ops-button"
                disabled={
                  azureChecking || !azureEndpoint.trim() || !azureKey.trim()
                }
                onClick={() => void verifyAzure()}
              >
                {azureChecking
                  ? "Đang tải cấu hình…"
                  : azureDeployment.trim()
                    ? "Kiểm tra & xác thực deployment"
                    : "Kiểm tra & tải cấu hình"}
              </button>
              <span className="verification-hint">
                API version và model được tải sau khi xác thực endpoint + API
                key. Nhập deployment rồi kiểm tra lại trước khi lưu.
              </span>
            </div>
            <label>
              API version
              <select
                value={azureVersion}
                disabled={!azureVerified || azureChecking}
                onChange={(event) => setAzureVersion(event.target.value)}
              >
                <option value="">
                  {azureChecking ? "Đang xác thực…" : "Chưa xác thực"}
                </option>
                {azureVerified && (
                  <option value={azureVersion}>{azureVersion}</option>
                )}
              </select>
            </label>
            <label>
              Mô hình
              <select
                value={azureModel}
                disabled={!azureVerified || azureChecking}
                onChange={(event) => setAzureModel(event.target.value)}
              >
                <option value="">
                  {azureChecking ? "Đang tải model…" : "Chưa có model khả dụng"}
                </option>
                {!azureVerified && azureModel && (
                  <option value={azureModel}>{azureModel}</option>
                )}
                {azureModels.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="api-key-field">
              Deployment
              <input
                value={azureDeployment}
                onChange={(event) => {
                  setAzureDeployment(event.target.value);
                  setAzureDeploymentVerified(false);
                }}
                placeholder="Nhập tên deployment Azure"
              />
              <small className="field-hint neutral">
                Deployment không thể liệt kê bằng API key; nhập theo tên đã tạo
                trên Azure.
              </small>
            </label>
            <button
              className="ops-button primary"
              disabled={
                !azureVerified ||
                !azureDeploymentVerified ||
                !azureDeployment.trim() ||
                !azureModel ||
                azureSaving
              }
              onClick={() => void saveAzure()}
            >
              {azureSaving ? "Đang lưu cấu hình…" : "Lưu cấu hình Azure"}
            </button>
          </section>
        </div>
      )}
      {settingsTab === "users" && <UserManagementSettings />}
      {settingsTab === "agent" && (
        <section className="ops-panel assistant-profile-card">
          <div className="provider-title">
            <span className="provider-logo persona">✦</span>
            <div>
              <b>Tính cách Trợ lý</b>
              <small>
                Điều chỉnh cách nói, không thay đổi nguyên tắc trả lời có căn
                cứ.
              </small>
            </div>
          </div>
          <div className="security-note">
            Tính cách chỉ ảnh hưởng giọng điệu. Trợ lý vẫn chỉ khẳng định thông
            tin có nguồn đã xác minh và sẽ chuyển chuyên gia khi cần.
          </div>
          <div className="profile-fields">
            <label>
              Tên Trợ lý
              <input
                value={profileName}
                maxLength={60}
                onChange={(event) => setProfileName(event.target.value)}
              />
            </label>
            <label>
              Vai trò
              <input
                value={profileRole}
                maxLength={300}
                onChange={(event) => setProfileRole(event.target.value)}
              />
            </label>
            <label>
              Giọng điệu
              <select
                value={profileTone}
                onChange={(event) => setProfileTone(event.target.value)}
              >
                <option value="professional">Chuyên nghiệp, ấm áp</option>
                <option value="friendly">Thân thiện, gần gũi</option>
                <option value="concise">Ngắn gọn, trực diện</option>
              </select>
            </label>
            <label>
              Độ dài phản hồi
              <select
                value={profileLength}
                onChange={(event) => setProfileLength(event.target.value)}
              >
                <option value="concise">Ngắn gọn</option>
                <option value="balanced">Cân bằng</option>
                <option value="detailed">Chi tiết</option>
              </select>
            </label>
            <label>
              Cách nói khi thiếu nguồn
              <select
                value={profileFallback}
                onChange={(event) => setProfileFallback(event.target.value)}
              >
                <option value="supportive">Nhẹ nhàng, hỗ trợ</option>
                <option value="direct">Trực tiếp, rõ ràng</option>
              </select>
            </label>
          </div>
          <label>
            Hướng dẫn bổ sung
            <textarea
              className="profile-instructions"
              value={profileInstructions}
              maxLength={1500}
              onChange={(event) => setProfileInstructions(event.target.value)}
              placeholder="Ví dụ: xưng hô bạn/tôi, ưu tiên câu ngắn và dễ dùng lại khi tư vấn khách hàng."
            />
            <small className="field-hint">
              {profileInstructions.length}/1.500 ký tự · Không thể dùng để bỏ
              qua nguyên tắc an toàn hoặc yêu cầu tiết lộ thông tin bảo mật.
            </small>
          </label>
          <div className="profile-preview">
            <b>Xem trước</b>
            <p>
              “Chào bạn! Tôi là {profileName || "Trợ lý phản hồi"}. Tôi sẵn sàng
              hỗ trợ tra cứu thông tin đã được xác minh.”
            </p>
          </div>
          <button
            className="ops-button primary"
            disabled={
              profileSaving ||
              profileName.trim().length < 2 ||
              profileRole.trim().length < 10
            }
            onClick={() => void saveProfile()}
          >
            {profileSaving ? "Đang lưu tính cách…" : "Lưu tính cách Trợ lý"}
          </button>
        </section>
      )}
      {settingsTab === "retrieval" && (
        <section className="settings-workspace">
          <aside className="settings-section-nav">
            <b>MỤC CẤU HÌNH TRANG NÀY</b>
            <button className="active">
              1 <span>Chọn nguồn tri thức</span>
            </button>
            <button>
              2 <span>Xếp hạng kết quả</span>
            </button>
            <button>
              3 <span>Quyết định phản hồi</span>
            </button>
            <button>
              4 <span>Chủ đề nhạy cảm</span>
            </button>
            <div className="decision-preview">
              <b>MINH HỌA QUYẾT ĐỊNH</b>
              <small>Live preview</small>
              <p>“Cấu hình DNS CNAME trỏ về hệ thống?”</p>
              <strong>Trả lời có nguồn</strong>
              <span>
                Ngưỡng hiện tại:{" "}
                {Math.round(retrieval.autoAnswerThreshold * 100)}%
              </span>
            </div>
          </aside>
          <div className="retrieval-panels">
            <div className="retrieval-intro">
              <div>
                <h2>Chất lượng tìm kiếm & phản hồi</h2>
                <p>
                  Điều chỉnh cách hệ thống chọn tài liệu, mức độ đa dạng nguồn
                  và ngưỡng an toàn phản hồi.
                </p>
              </div>
              <span className="success-pill">● Đang dùng cấu hình an toàn</span>
            </div>
            <section className="ops-panel retrieval-card">
              <h3>1. Chọn nguồn tri thức</h3>
              <p>
                Giới hạn các tài liệu đưa vào ngữ cảnh trước khi Agent trả lời.
              </p>
              <div className="settings-control-grid">
                <label>
                  Số kết quả thô hiển thị sau tìm kiếm
                  <input
                    type="range"
                    min="3"
                    max="30"
                    value={retrieval.topK}
                    onChange={(e) =>
                      setRetrieval({
                        ...retrieval,
                        topK: Number(e.target.value),
                      })
                    }
                  />
                  <small>{retrieval.topK} kết quả</small>
                </label>
                <label>
                  Số bài viết tối đa đưa vào prompt
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={retrieval.maxArticles}
                    onChange={(e) =>
                      setRetrieval({
                        ...retrieval,
                        maxArticles: Number(e.target.value),
                      })
                    }
                  />
                  <small>{retrieval.maxArticles} bài viết</small>
                </label>
              </div>
              <label className="setting-switch">
                <input
                  type="checkbox"
                  checked={retrieval.verifiedOnly}
                  onChange={(e) =>
                    setRetrieval({
                      ...retrieval,
                      verifiedOnly: e.target.checked,
                    })
                  }
                />
                <span>
                  <b>Ưu tiên bài đã được duyệt</b>
                  <small>Chỉ dùng nguồn xuất bản và được phép vận hành.</small>
                </span>
              </label>
              <label className="setting-switch">
                <input type="checkbox" checked={retrieval.shadowMode} onChange={(e) => setRetrieval({ ...retrieval, shadowMode: e.target.checked })} />
                <span><b>Chạy đánh giá song song</b><small>So sánh AI re-ranking với tìm kiếm thường trong log; không đổi câu trả lời gửi cho nhân viên.</small></span>
              </label>
              <label className="setting-switch">
                <input
                  type="checkbox"
                  checked={retrieval.excludeReplaced}
                  onChange={(e) =>
                    setRetrieval({
                      ...retrieval,
                      excludeReplaced: e.target.checked,
                    })
                  }
                />
                <span>
                  <b>Loại bài đã bị thay thế hoặc lưu trữ</b>
                  <small>Không đưa nguồn lỗi thời vào câu trả lời.</small>
                </span>
              </label>
            </section>
            <section className="ops-panel retrieval-card">
              <h3>2. Xếp hạng kết quả</h3>
              <p>Điểm tìm kiếm không phải là độ tin cậy của câu trả lời.</p>
              <div className="settings-control-grid">
                <label>
                  Từ khóa
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(retrieval.keywordWeight * 100)}
                    onChange={(e) => {
                      const keywordWeight = Number(e.target.value) / 100;
                      setRetrieval({
                        ...retrieval,
                        keywordWeight,
                        semanticWeight: 1 - keywordWeight,
                      });
                    }}
                  />
                  <small>{Math.round(retrieval.keywordWeight * 100)}%</small>
                </label>
                <label>
                  AI đánh giá mức phù hợp
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(retrieval.semanticWeight * 100)}
                    onChange={(e) => {
                      const semanticWeight = Number(e.target.value) / 100;
                      setRetrieval({
                        ...retrieval,
                        semanticWeight,
                        keywordWeight: 1 - semanticWeight,
                      });
                    }}
                  />
                  <small>{Math.round(retrieval.semanticWeight * 100)}% trọng số sau khi AI rà soát</small>
                </label>
                <label>
                  Đa dạng nguồn
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(retrieval.diversityWeight * 100)}
                    onChange={(e) =>
                      setRetrieval({
                        ...retrieval,
                        diversityWeight: Number(e.target.value) / 100,
                      })
                    }
                  />
                  <small>{Math.round(retrieval.diversityWeight * 100)}%</small>
                </label>
              </div>
            </section>
            <section className="ops-panel retrieval-card">
              <h3>3. Quyết định phản hồi</h3>
              <div className="threshold-grid">
                <label>
                  Tự trả lời
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={Math.round(retrieval.autoAnswerThreshold * 100)}
                    onChange={(e) =>
                      setRetrieval({
                        ...retrieval,
                        autoAnswerThreshold: Number(e.target.value) / 100,
                      })
                    }
                  />
                  <small>% đủ căn cứ</small>
                </label>
                <label>
                  Trả lời một phần
                  <input
                    type="number"
                    min="30"
                    max="95"
                    value={Math.round(retrieval.partialAnswerThreshold * 100)}
                    onChange={(e) =>
                      setRetrieval({
                        ...retrieval,
                        partialAnswerThreshold: Number(e.target.value) / 100,
                      })
                    }
                  />
                  <small>% có nguồn liên quan</small>
                </label>
                <label>
                  Chủ đề nhạy cảm
                  <input
                    type="number"
                    min="70"
                    max="100"
                    value={Math.round(retrieval.sensitiveThreshold * 100)}
                    onChange={(e) =>
                      setRetrieval({
                        ...retrieval,
                        sensitiveThreshold: Number(e.target.value) / 100,
                      })
                    }
                  />
                  <small>% bắt buộc tối thiểu</small>
                </label>
              </div>
            </section>
            <section className="ops-panel retrieval-card">
              <h3>4. Chủ đề nhạy cảm</h3>
              <p>
                Phân tách bằng dấu phẩy. Các chủ đề này luôn dùng ngưỡng nghiêm
                ngặt hơn.
              </p>
              <input
                value={retrieval.sensitiveTopics.join(", ")}
                onChange={(e) =>
                  setRetrieval({
                    ...retrieval,
                    sensitiveTopics: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
            </section>
            <section className="ops-panel retrieval-card">
              <h3>5. Gộp bài viết tương tự</h3>
              <p>
                Các giá trị này chỉ áp dụng cho đợt gộp mới. Mỗi đợt sẽ lưu lại
                tiêu chí đã dùng để bạn đối soát kết quả về sau.
              </p>
              <div className="settings-control-grid">
                <label>
                  Ngưỡng sàng lọc {Math.round(retrieval.mergePrefilterThreshold * 100)}%
                  <input type="range" min="20" max="80" value={Math.round(retrieval.mergePrefilterThreshold * 100)} onChange={(e) => setRetrieval({ ...retrieval, mergePrefilterThreshold: Number(e.target.value) / 100 })} />
                  <small>Chỉ đưa các bài có dấu hiệu liên quan từ mức này vào Agent. Thấp hơn sẽ tìm rộng hơn nhưng tốn thời gian hơn.</small>
                </label>
                <label>
                  Ngưỡng đề xuất gộp {Math.round(retrieval.mergeSuggestionThreshold * 100)}%
                  <input type="range" min="50" max="98" value={Math.round(retrieval.mergeSuggestionThreshold * 100)} onChange={(e) => setRetrieval({ ...retrieval, mergeSuggestionThreshold: Number(e.target.value) / 100 })} />
                  <small>Agent chỉ đề xuất khi hai bài đủ gần nhau. Ví dụ TXT record và Bản ghi TXT thường cần được đối chiếu.</small>
                </label>
                <label>
                  Nội dung riêng tối đa {Math.round(retrieval.mergeUniqueCoverageThreshold * 100)}%
                  <input type="range" min="5" max="80" value={Math.round(retrieval.mergeUniqueCoverageThreshold * 100)} onChange={(e) => setRetrieval({ ...retrieval, mergeUniqueCoverageThreshold: Number(e.target.value) / 100 })} />
                  <small>Nếu một bài có phần riêng từ mức này, Agent sẽ đề xuất gộp một phần để không làm mất tri thức.</small>
                </label>
              </div>
              <label className="settings-textarea-label">
                Từ đồng nghĩa phục vụ gộp bài
                <textarea value={retrieval.mergeSynonyms.join("\n")} onChange={(e) => setRetrieval({ ...retrieval, mergeSynonyms: e.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} placeholder="txt record = bản ghi txt" />
                <small>Mỗi dòng một cặp theo dạng <b>cụm từ A = cụm từ B</b>. Hệ thống kiểm tra hai chiều; ví dụ trên giúp nhận ra “TXT record” và “bản ghi TXT” dù khác câu chữ.</small>
              </label>
            </section>
            <div className="settings-save-row">
              <button
                className="ops-button"
                onClick={() =>
                  setRetrieval({
                    topK: 10,
                    maxArticles: 3,
                    keywordWeight: 0.4,
                    semanticWeight: 0.6,
                    diversityWeight: 0.3,
                    autoAnswerThreshold: 0.8,
                    partialAnswerThreshold: 0.6,
                    sensitiveThreshold: 0.9,
                    sensitiveTopics: [
                      "Giá & báo giá",
                      "Hợp đồng",
                      "Bảo mật",
                      "SLA",
                    ],
                    verifiedOnly: true,
                    excludeReplaced: true,
                    shadowMode: false,
                    mergePrefilterThreshold: 0.4,
                    mergeSuggestionThreshold: 0.78,
                    mergeUniqueCoverageThreshold: 0.25,
                    mergeSynonyms: ["record = bản ghi", "txt record = bản ghi txt"],
                  })
                }
              >
                Khôi phục mặc định
              </button>
              <button
                className="ops-button primary"
                disabled={retrievalSaving}
                onClick={() => void saveRetrieval()}
              >
                {retrievalSaving ? "Đang lưu…" : "Lưu cấu hình tri thức"}
              </button>
            </div>
          </div>
        </section>
      )}
      </section>
    </Shell>
  );
}

export default function OperationsScreen({ screen }: { screen: Screen }) {
  const content = screen === "assistant" ? (
    <AssistantScreen />
  ) : screen === "conversations" ? (
    <ConversationsScreen />
  ) : screen === "knowledge" ? (
    <KnowledgeScreen />
  ) : screen === "queue" ? (
    <QueueScreen />
  ) : screen === "review" ? (
    <ReviewScreen />
  ) : screen === "profile" ? (
    <ProfileScreen />
  ) : (
    <SettingsScreen />
  );
  return <AppFeedbackProvider>{content}</AppFeedbackProvider>;
}
