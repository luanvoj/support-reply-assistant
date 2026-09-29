"use client";

import { useEffect, useState } from "react";
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
  EmptyState,
} from "@/components/ui";

type Ticket = {
  id: string;
  original_question: string;
  reason_code: string;
  retrieval_score: number | null;
  status: string;
  creator: string;
  created_at: string;
};

export function ReviewScreen() {
  const router = useRouter();
  const { notify } = useFeedback();
  const [id, setId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [answer, setAnswer] = useState("");
  const [title, setTitle] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetch("/api/unanswered")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        const found = (b?.questions ?? []).find((item: Ticket) => item.id === id);
        setTicket(found ?? null);
        if (found) {
          setTitle(found.original_question.slice(0, 100));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const publish = async () => {
    if (!id || !answer || !title) return;
    setPublishing(true);
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

    setPublishing(false);
    if (response.ok) {
      notify("Đã xuất bản câu trả lời thành bài viết và đóng câu hỏi trong hàng đợi.", "success");
      setTimeout(() => router.push("/unanswered"), 900);
    } else {
      notify("Không thể xuất bản bài viết. Hãy kiểm tra thông tin và quyền hạn thao tác.", "error");
    }
  };

  const getReasonLabel = (reasonCode: string, score: number | null) => {
    switch (reasonCode) {
      case "missing_knowledge":
        return "Chưa có bài viết phù hợp trong kho tri thức.";
      case "expert_required":
        return "Nguồn yêu cầu chuyên gia xác nhận trước khi tư vấn chi tiết.";
      case "expert_requested":
        return "Người dùng hoặc tư vấn viên yêu cầu chuyên gia hỗ trợ thêm.";
      default:
        return score !== null
          ? `Độ tin cậy ${Math.round(score * 100)}% chưa đạt ngưỡng trả lời tự động an toàn.`
          : "Cần chuyên gia rà soát nội dung trước khi xuất bản.";
    }
  };

  return (
    <AppShell screen="review">
      <div className="bento-page-header">
        <div>
          <span className="bento-eyebrow">THẨM ĐỊNH & XUẤT BẢN</span>
          <h1 className="bento-page-title">Rà soát & Xuất bản Tri thức</h1>
          <p className="bento-page-desc">
            Chuyển câu hỏi chưa có căn cứ thành bài viết tài liệu chính thức đã được phê duyệt.
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={() => router.push("/unanswered")}>
          ← Quay lại hàng đợi
        </Button>
      </div>

      {!id ? (
        <Card>
          <CardContent style={{ padding: "3rem" }}>
            <EmptyState
              title="Chưa chọn câu hỏi cần rà soát"
              description="Vui lòng mở một câu hỏi từ Hàng đợi xử lý để bắt đầu thẩm định và biên soạn câu trả lời."
              action={
                <Button variant="primary" size="md" onClick={() => router.push("/unanswered")}>
                  Đến hàng đợi xử lý →
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent style={{ padding: "3rem", textAlign: "center" }}>
            <p style={{ color: "var(--color-text-secondary)" }}>Đang tải thông tin câu hỏi...</p>
          </CardContent>
        </Card>
      ) : !ticket ? (
        <Card>
          <CardContent style={{ padding: "3rem" }}>
            <EmptyState
              title="Không tìm thấy câu hỏi"
              description="Câu hỏi này có thể đã được giải quyết hoặc không tồn tại trong hệ thống."
              action={
                <Button variant="primary" size="md" onClick={() => router.push("/unanswered")}>
                  Về danh sách hàng đợi →
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
          {/* Cột trái: Thông tin câu hỏi & Chẩn đoán */}
          <Card>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <Badge variant="warning" size="md">CẦN RÀ SOÁT</Badge>
                <span style={{ fontSize: "0.8125rem", color: "var(--color-text-tertiary)" }}>
                  Mã: {ticket.id.slice(0, 8)}
                </span>
              </div>
              <CardTitle style={{ fontSize: "1.25rem", lineHeight: "1.5" }}>
                {ticket.original_question}
              </CardTitle>
              <CardDescription>
                Tạo bởi <strong>{ticket.creator}</strong> • Ngày:{" "}
                {new Date(ticket.created_at).toLocaleString("vi-VN")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  background: "var(--color-bg-secondary)",
                  borderRadius: "var(--radius-md)",
                  padding: "1rem",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <strong style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem" }}>
                  Lý do trợ lý chưa thể tự trả lời:
                </strong>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-text-secondary)", lineHeight: "1.6" }}>
                  {getReasonLabel(ticket.reason_code, ticket.retrieval_score)}
                </p>
                {ticket.retrieval_score !== null && (
                  <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--color-text-tertiary)" }}>
                      Độ tương đồng cao nhất:
                    </span>
                    <Badge variant="neutral" size="sm">
                      {Math.round(ticket.retrieval_score * 100)}%
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cột phải: Form biên soạn & xuất bản */}
          <Card>
            <CardHeader>
              <CardTitle>Biên soạn tài liệu chính thức</CardTitle>
              <CardDescription>
                Nội dung duyệt sẽ được tự động chia đoạn và lập chỉ mục vào kho tri thức để Trợ lý tra cứu sau này.
              </CardDescription>
            </CardHeader>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <Input
                label="Tiêu đề bài viết tri thức mới"
                placeholder="Ví dụ: Hướng dẫn cấu hình bản ghi DNS tên miền"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                hint="Tiêu đề rõ ràng giúp tìm kiếm ngữ nghĩa chính xác hơn."
              />
              <Textarea
                label="Nội dung câu trả lời chuẩn (Markdown)"
                placeholder="Viết câu trả lời đầy đủ, chi tiết và chính xác đã được thẩm định…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={9}
                hint="Nội dung tối thiểu 20 ký tự."
              />
            </CardContent>
            <CardFooter style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.push("/unanswered")}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={publishing || title.trim().length < 3 || answer.trim().length < 20}
                onClick={() => void publish()}
              >
                {publishing ? "Đang xuất bản…" : "Xuất bản & Đóng câu hỏi →"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
