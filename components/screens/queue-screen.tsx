"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useFeedback } from "@/components/app-shell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  Textarea,
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui";

export type Ticket = {
  id: string;
  original_question: string;
  reason_code: string;
  retrieval_score: number | null;
  status: string;
  creator: string;
  created_at: string;
};

export function QueueScreen() {
  const router = useRouter();
  const { notify } = useFeedback();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const processingEditorRef = useRef<HTMLDivElement | null>(null);
  const processingTitleRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query.trim()) params.set("search", query.trim());
    if (selectedId) params.set("id", selectedId);
    const response = await fetch(`/api/unanswered?${params.toString()}`).catch(
      () => null
    );
    const body = await response?.json().catch(() => ({}));
    setLoading(false);
    if (!response?.ok) {
      notify("Không thể tải danh sách yêu cầu chuyên gia.", "error");
      return;
    }
    const questions = body.questions ?? [];
    setTickets(questions);
    setPagination(body.pagination ?? { page: 1, pageSize: 20, total: 0 });
    setSelectedTicket(
      body.selected ??
        questions.find((item: Ticket) => item.id === selectedId) ??
        null
    );
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPage = Number(params.get("page") ?? 1);
    setPage(
      Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1
    );
    setSelectedId(params.get("id"));
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (initialized) void load();
  }, [initialized, page, query, selectedId]);

  useEffect(() => {
    if (!selectedTicket) return;
    const frame = window.requestAnimationFrame(() => {
      processingEditorRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      processingTitleRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedTicket?.id]);

  const reasonText = (ticket: Ticket) =>
    ticket.reason_code === "missing_knowledge"
      ? "Không tìm thấy tài liệu phù hợp trong Kho kiến thức."
      : ticket.reason_code === "expert_required"
      ? "Nội dung cần chuyên gia xác nhận trước khi tư vấn."
      : ticket.reason_code === "expert_requested"
      ? "Người dùng cần chuyên gia hỗ trợ thêm cho câu trả lời này."
      : `Độ tin cậy ${Math.round((ticket.retrieval_score ?? 0) * 100)}% chưa đạt ngưỡng trả lời an toàn.`;

  const reasonLabel = (ticket: Ticket) =>
    ticket.reason_code === "missing_knowledge"
      ? "Thiếu tài liệu"
      : ticket.reason_code === "expert_required"
      ? "Cần chuyên gia xác nhận"
      : ticket.reason_code === "expert_requested"
      ? "Yêu cầu hỗ trợ thêm"
      : "Độ tin cậy thấp";

  const statusLabel = (status: string) => {
    switch (status) {
      case "new":
        return "Mới";
      case "in_progress":
      case "open":
        return "Đang xử lý";
      case "resolved":
        return "Đã giải quyết";
      case "closed":
        return "Đã đóng";
      default:
        return status;
    }
  };

  const open = (ticket: Ticket) => {
    setSelectedId(ticket.id);
    setSelectedTicket(ticket);
    setTitle("");
    setAnswer("");
    router.replace(`/unanswered?id=${ticket.id}&page=${page}`);
  };

  const close = () => {
    setSelectedId(null);
    setSelectedTicket(null);
    setTitle("");
    setAnswer("");
    router.replace(`/unanswered?page=${page}`);
  };

  const deleteNewTicket = async () => {
    if (!selectedTicket || selectedTicket.status !== "new") return;
    if (!window.confirm("Xóa vĩnh viễn yêu cầu mới này? Thao tác không thể hoàn tác."))
      return;
    const response = await fetch(`/api/unanswered/${selectedTicket.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      notify(body?.error ?? "Không thể xóa yêu cầu chuyên gia.", "error");
      return;
    }
    notify("Đã xóa vĩnh viễn yêu cầu mới.", "success");
    close();
    await load();
  };

  const publish = async () => {
    if (!selectedTicket || title.trim().length < 3 || answer.trim().length < 20)
      return;
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const response = await fetch(`/api/unanswered/${selectedTicket.id}/review`, {
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
    if (!response.ok) {
      notify("Không thể xuất bản. Hãy kiểm tra quyền và nội dung.", "error");
      return;
    }
    notify("Đã bổ sung tri thức đã xác minh và đóng yêu cầu.", "success");
    close();
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  const processingEditor = selectedTicket ? (
    <Card style={{ padding: "var(--space-6)", marginBottom: "var(--space-5)" }} ref={processingEditorRef}>
      <div className="bento-panel-header" style={{ marginBottom: "var(--space-4)", paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <span className="bento-eyebrow">YÊU CẦU ĐANG XỬ LÝ</span>
          <h2 className="bento-page-title" style={{ fontSize: "var(--text-xl)" }}>{selectedTicket.original_question}</h2>
          <p className="bento-page-desc">{reasonText(selectedTicket)}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={close}>Đóng cửa sổ</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        <div className="ui-card ui-card-subtle" style={{ padding: "var(--space-3)" }}>
          <small className="bento-table-sub" style={{ textTransform: "uppercase", fontWeight: 700 }}>Trạng thái</small>
          <Badge
            variant={selectedTicket.status === "resolved" ? "success" : "warning"}
            size="sm"
            style={{ marginTop: "4px" }}
          >
            {statusLabel(selectedTicket.status)}
          </Badge>
        </div>
        <div className="ui-card ui-card-subtle" style={{ padding: "var(--space-3)" }}>
          <small className="bento-table-sub" style={{ textTransform: "uppercase", fontWeight: 700 }}>Độ tương đồng</small>
          <strong style={{ display: "block", marginTop: "4px", fontSize: "var(--text-md)", color: "var(--text-primary)" }}>
            {Math.round((selectedTicket.retrieval_score ?? 0) * 100)}%
          </strong>
        </div>
        <div className="ui-card ui-card-subtle" style={{ padding: "var(--space-3)" }}>
          <small className="bento-table-sub" style={{ textTransform: "uppercase", fontWeight: 700 }}>Người gửi</small>
          <strong style={{ display: "block", marginTop: "4px", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
            {selectedTicket.creator}
          </strong>
        </div>
        <div className="ui-card ui-card-subtle" style={{ padding: "var(--space-3)" }}>
          <small className="bento-table-sub" style={{ textTransform: "uppercase", fontWeight: 700 }}>Thời gian</small>
          <strong style={{ display: "block", marginTop: "4px", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
            {new Date(selectedTicket.created_at).toLocaleString("vi-VN")}
          </strong>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input
          ref={processingTitleRef}
          label="Tiêu đề tài liệu tri thức mới"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ví dụ: Hướng dẫn cấu hình DNS tên miền …"
        />
        <Textarea
          label="Câu trả lời chính xác đã được chuyên gia xác minh"
          style={{ minHeight: "140px" }}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Viết nội dung giải đáp chi tiết, có căn cứ rõ ràng để Trợ lý AI có thể dùng lại cho các khách hàng sau…"
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)", marginTop: "var(--space-5)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-subtle)" }}>
        <small className="bento-table-sub">Nội dung sau khi xuất bản sẽ được tự động đồng bộ và đóng yêu cầu này.</small>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {selectedTicket.status === "new" && (
            <Button variant="danger" size="md" onClick={() => void deleteNewTicket()}>
              Xóa yêu cầu này
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            disabled={title.trim().length < 3 || answer.trim().length < 20}
            onClick={() => void publish()}
          >
            Xuất bản tri thức & đóng yêu cầu →
          </Button>
        </div>
      </div>
    </Card>
  ) : null;

  return (
    <AppShell screen="queue">
      <div className="bento-page-header">
        <div>
          <span className="bento-eyebrow">KHÔNG GIAN LÀM VIỆC / HÀNG ĐỢI</span>
          <h1 className="bento-page-title">Yêu cầu chuyên gia</h1>
          <p className="bento-page-desc">
            Tiếp nhận các câu hỏi Trợ lý chưa thể phản hồi an toàn và biến kiến thức đã xác nhận thành tài sản dùng lại.
          </p>
        </div>
        <div className="bento-header-actions">
          <Button
            variant="secondary"
            size="md"
            disabled={loading}
            onClick={() => void load()}
          >
            ↻ Làm mới danh sách
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {processingEditor}
        <Card>
          <CardHeader className="bento-panel-header">
            <div>
              <CardTitle>Danh sách yêu cầu cần xử lý</CardTitle>
              <CardDescription>
                {loading ? "Đang tải dữ liệu…" : `Tổng cộng ${pagination.total} yêu cầu trong hàng đợi.`}
              </CardDescription>
            </div>
            <div style={{ minWidth: "260px" }}>
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo câu hỏi hoặc người tạo…"
                aria-label="Tìm yêu cầu chuyên gia"
              />
            </div>
          </CardHeader>

          <CardContent style={{ padding: 0 }}>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Câu hỏi gốc</TableHead>
                    <TableHead>Độ tin cậy</TableHead>
                    <TableHead>Nguyên nhân</TableHead>
                    <TableHead>Người tạo</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead style={{ textAlign: "right" }}>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length ? (
                    tickets.map((item) => (
                      <TableRow
                        isSelected={item.id === selectedId}
                        key={item.id}
                      >
                        <TableCell>
                          <strong className="bento-table-lead" title={item.original_question}>
                            {item.original_question}
                          </strong>
                          <small className="bento-table-sub">
                            {new Date(item.created_at).toLocaleString("vi-VN")}
                          </small>
                        </TableCell>
                        <TableCell>
                          <Badge variant="warning" size="sm">
                            {Math.round((item.retrieval_score ?? 0) * 100)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.reason_code === "expert_required"
                                ? "brand"
                                : item.reason_code === "missing_knowledge"
                                ? "danger"
                                : item.reason_code === "expert_requested"
                                ? "info"
                                : "warning"
                            }
                            size="sm"
                          >
                            {reasonLabel(item)}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.creator}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "new" || item.status === "open"
                                ? "warning"
                                : item.status === "resolved"
                                ? "success"
                                : "neutral"
                            }
                            size="sm"
                          >
                            {statusLabel(item.status)}
                          </Badge>
                        </TableCell>
                        <TableCell style={{ textAlign: "right" }}>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Xử lý yêu cầu: ${item.original_question}`}
                            onClick={() => open(item)}
                          >
                            {item.id === selectedId ? "Đang mở" : "Xử lý →"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--text-muted)" }}>
                        {loading
                          ? "Đang tải yêu cầu…"
                          : "Không có câu hỏi nào cần chuyên gia xử lý."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>

          {pagination.total > pagination.pageSize && (
            <CardFooter style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1 || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                ← Trang trước
              </Button>
              <span className="bento-table-sub">
                Trang {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Trang sau →
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
