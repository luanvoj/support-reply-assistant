"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NavigationIcon } from "@/components/navigation-icon";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
  Tabs,
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from "@/components/ui";

type QueueItem = {
  id: string;
  original_question: string;
  retrieval_score: number | null;
  reason_code: string;
  status: string;
  creator: string;
  created_at: string;
};

function TrendChart({ period }: { period: string }) {
  return (
    <div className="bento-trend-chart-wrap" aria-label="Biểu đồ hoạt động">
      <svg
        viewBox="0 0 720 180"
        role="img"
        className="bento-svg-chart"
        aria-label="Xu hướng câu trả lời có căn cứ"
      >
        <defs>
          <linearGradient id="bento-area-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Vùng đổ màu Gradient dưới đường biểu đồ chính */}
        <path
          d="M0 140 C60 130 90 138 140 120 S210 110 250 118 S310 102 350 90 S420 98 460 72 S520 78 570 50 S640 58 720 20 L720 180 L0 180Z"
          fill="url(#bento-area-gradient)"
        />

        {/* Đường biểu đồ Phản hồi có căn cứ (Chính) */}
        <path
          d="M0 140 C60 130 90 138 140 120 S210 110 250 118 S310 102 350 90 S420 98 460 72 S520 78 570 50 S640 58 720 20"
          fill="none"
          stroke="#4f46e5"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Đường biểu đồ Chuyển chuyên gia (Phụ) */}
        <path
          d="M0 165 C80 160 130 164 180 150 S270 158 320 140 S410 145 460 125 S540 135 600 110 S670 120 720 95"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
      </svg>

      <div className="bento-chart-axis">
        <span>{period === "Ngày" ? "6 ngày trước" : period === "Giờ" ? "00:00" : "4 tuần trước"}</span>
        <span>Khoảng thời gian {period.toLowerCase()}</span>
        <span>Hôm nay</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [period, setPeriod] = useState("Ngày");
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/dashboard/summary"),
      fetch("/api/unanswered?status=open"),
    ])
      .then(async ([summaryResponse, queueResponse]) => {
        if (summaryResponse.ok)
          setSummary((await summaryResponse.json()).summary ?? {});
        if (queueResponse.ok)
          setQueue((await queueResponse.json()).questions ?? []);
      })
      .catch(() =>
        setNotice("Không thể tải số liệu mới. Hãy kiểm tra kết nối hệ thống.")
      );
  }, []);

  const getReasonLabel = (reasonCode: string) => {
    switch (reasonCode) {
      case "missing_knowledge":
        return "Thiếu tài liệu";
      case "expert_required":
        return "Cần chuyên gia xác nhận";
      case "expert_requested":
        return "Yêu cầu hỗ trợ thêm";
      case "low_confidence":
        return "Độ tin cậy thấp";
      default:
        return "Nguyên nhân chưa xác định";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "new":
      case "open":
        return "Chờ xử lý";
      case "in_progress":
      case "in_review":
        return "Đang xử lý";
      case "answered":
      case "resolved":
        return "Đã giải quyết";
      case "published":
        return "Đã xuất bản";
      case "rejected":
        return "Đã từ chối";
      case "closed":
        return "Đã đóng";
      default:
        return "Không xác định";
    }
  };

  const filteredQueue = useMemo(
    () =>
      queue.filter((item) => {
        const reasonText = getReasonLabel(item.reason_code);
        const statusText = getStatusLabel(item.status);
        return `${item.original_question} ${item.creator} ${item.reason_code} ${reasonText} ${statusText}`
          .toLowerCase()
          .includes(search.toLowerCase());
      }),
    [queue, search]
  );

  return (
    <AppShell screen="overview">
      <div className="bento-overview-container">
        {/* Tiêu Đề Trang & Nút Hành Động Nhanh */}
        <div className="bento-page-header">
          <div>
            <span className="bento-eyebrow">TỔNG QUAN HỆ THỐNG</span>
            <h1 className="bento-page-title">Vận hành kho kiến thức</h1>
            <p className="bento-page-desc">
              Theo dõi chất lượng phản hồi có căn cứ, chỉ số độ tin cậy và hàng đợi chuyển giao chuyên gia.
            </p>
          </div>
          <div className="bento-header-actions">
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push("/assistant")}
            >
              Hỏi trợ lý ↗
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push("/knowledge-base?new=1")}
            >
              + Thêm tài liệu mới
            </Button>
          </div>
        </div>

        {/* Thông báo nếu có lỗi */}
        {notice && (
          <div className="bento-alert-banner">
            <span className="bento-alert-dot" />
            <span>{notice}</span>
            <button
              type="button"
              className="bento-alert-close"
              onClick={() => setNotice("")}
            >
              Đóng
            </button>
          </div>
        )}

        {/* Banner trạng thái đồng bộ */}
        <div className="bento-sync-banner">
          <Badge variant="success" dot pulse size="sm">
            AI Đang hoạt động
          </Badge>
          <span className="bento-banner-divider">|</span>
          <span className="bento-sync-text">
            Đồng bộ tri thức thời gian thực: <strong>Kho tài liệu sẵn sàng</strong>
          </span>
        </div>

        {/* Lưới 4 Thẻ Bento KPI */}
        <div className="bento-kpi-grid">
          <Card hoverable className="bento-kpi-card">
            <div className="bento-kpi-top">
              <span className="bento-kpi-label">Hội thoại 30 ngày</span>
              <div className="bento-kpi-icon bento-icon-blue">
                <NavigationIcon name="conversations" />
              </div>
            </div>
            <strong className="bento-kpi-value">
              {summary.conversations_30d ?? "—"}
            </strong>
            <div className="bento-kpi-foot">
              <Badge variant="brand" size="sm">Dữ liệu thực</Badge>
              <span>từ các phiên hỗ trợ</span>
            </div>
          </Card>

          <Card hoverable className="bento-kpi-card">
            <div className="bento-kpi-top">
              <span className="bento-kpi-label">Phản hồi trợ lý</span>
              <div className="bento-kpi-icon bento-icon-green">
                <NavigationIcon name="assistant" />
              </div>
            </div>
            <strong className="bento-kpi-value">
              {summary.assistant_messages_30d ?? "—"}
            </strong>
            <div className="bento-kpi-foot">
              <Badge variant="success" size="sm">Đã đối chiếu</Badge>
              <span>nguồn tham chiếu</span>
            </div>
          </Card>

          <Card hoverable className="bento-kpi-card">
            <div className="bento-kpi-top">
              <span className="bento-kpi-label">Chờ chuyên gia xử lý</span>
              <div className="bento-kpi-icon bento-icon-amber">
                <NavigationIcon name="queue" />
              </div>
            </div>
            <strong className="bento-kpi-value">
              {summary.unanswered_open ?? "—"}
            </strong>
            <div className="bento-kpi-foot">
              <Badge variant="warning" size="sm">Cần rà soát</Badge>
              <span>câu hỏi thiếu căn cứ</span>
            </div>
          </Card>

          <Card hoverable className="bento-kpi-card">
            <div className="bento-kpi-top">
              <span className="bento-kpi-label">Độ căn cứ trung bình</span>
              <div className="bento-kpi-icon bento-icon-purple">
                <NavigationIcon name="knowledge" />
              </div>
            </div>
            <strong className="bento-kpi-value">
              {summary.avg_evidence_30d !== undefined && summary.avg_evidence_30d !== null
                ? `${Math.round(Number(summary.avg_evidence_30d) * 100)}%`
                : "—"}
            </strong>
            <div className="bento-kpi-foot">
              <Badge variant="info" size="sm">
                {summary.grounded_answers_30d ?? 0} có căn cứ
              </Badge>
              <span>/ {summary.escalated_answers_30d ?? 0} chuyển tiếp</span>
            </div>
          </Card>
        </div>

        {/* Lưới Nội Dung Bento: Biểu đồ & Tác vụ ưu tiên */}
        <div className="bento-main-grid">
          {/* Biểu đồ xu hướng */}
          <Card className="bento-chart-panel">
            <CardHeader className="bento-panel-header">
              <div>
                <CardTitle>Xu hướng hoạt động & độ tin cậy</CardTitle>
                <CardDescription>
                  So sánh tỷ lệ câu trả lời có căn cứ đối chiếu với câu hỏi cần chuyên gia
                </CardDescription>
              </div>
              <Tabs
                variant="segmented"
                size="sm"
                activeKey={period}
                onChange={setPeriod}
                items={[
                  { key: "Giờ", label: "Giờ" },
                  { key: "Ngày", label: "Ngày" },
                  { key: "Tuần", label: "Tuần" },
                ]}
              />
            </CardHeader>
            <CardContent>
              <TrendChart period={period} />
              <div className="bento-chart-legend">
                <div className="bento-legend-item">
                  <span className="bento-legend-dot bento-dot-primary" />
                  <span>Phản hồi có căn cứ</span>
                </div>
                <div className="bento-legend-item">
                  <span className="bento-legend-dot bento-dot-muted" />
                  <span>Chuyển chuyên gia</span>
                </div>
                <div className="bento-legend-summary">
                  <span>Khoảng thời gian:</span>
                  <strong>{period}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tác vụ cần ưu tiên */}
          <Card className="bento-priority-panel">
            <CardHeader className="bento-panel-header">
              <div>
                <CardTitle>Tác vụ cần ưu tiên</CardTitle>
                <CardDescription>
                  Đường tắt nhanh đến các màn hình vận hành chính
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/knowledge-base")}
              >
                Mở kho →
              </Button>
            </CardHeader>
            <CardContent className="bento-shortcuts-list">
              <button
                type="button"
                className="bento-shortcut-item"
                onClick={() => router.push("/unanswered")}
              >
                <div className="bento-shortcut-idx">01</div>
                <div className="bento-shortcut-body">
                  <strong>Hàng đợi chưa trả lời</strong>
                  <span>{summary.unanswered_open ?? 0} câu hỏi cần chuyên gia giải quyết</span>
                </div>
                <Badge variant="warning" size="sm">Cần xử lý</Badge>
              </button>

              <button
                type="button"
                className="bento-shortcut-item"
                onClick={() => router.push("/assistant")}
              >
                <div className="bento-shortcut-idx">02</div>
                <div className="bento-shortcut-body">
                  <strong>Đặt câu hỏi cho trợ lý</strong>
                  <span>Truy xuất và kiểm tra câu trả lời có dẫn chứng</span>
                </div>
                <Badge variant="brand" size="sm">Thử nghiệm</Badge>
              </button>

              <button
                type="button"
                className="bento-shortcut-item"
                onClick={() => router.push("/settings")}
              >
                <div className="bento-shortcut-idx">03</div>
                <div className="bento-shortcut-body">
                  <strong>Cấu hình & Nhật ký hệ thống</strong>
                  <span>Kiểm tra provider AI, độ tương đồng và audit logs</span>
                </div>
                <Badge variant="neutral" size="sm">Quản trị</Badge>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Hàng Đợi Câu Hỏi Mới Cần Xử Lý */}
        <Card className="bento-queue-section">
          <CardHeader className="bento-panel-header">
            <div>
              <div className="bento-title-with-badge">
                <CardTitle>Hàng đợi chuyên gia cần xử lý</CardTitle>
                <Badge variant="warning" size="sm">
                  {queue.length} câu hỏi
                </Badge>
              </div>
              <CardDescription>
                Các câu hỏi mà trợ lý chưa đủ độ tin cậy để tự động phản hồi
              </CardDescription>
            </div>
            <div className="bento-queue-toolbar">
              <Input
                placeholder="Tìm câu hỏi, người tạo, mã lý do…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bento-search-input"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/unanswered")}
              >
                Xem tất cả →
              </Button>
            </div>
          </CardHeader>
          <CardContent style={{ padding: 0 }}>
            {filteredQueue.length === 0 ? (
              <EmptyState
                title="Không có câu hỏi nào trong hàng đợi"
                description={
                  search
                    ? "Không tìm thấy câu hỏi khớp với từ khóa tìm kiếm."
                    : "Hệ thống đang hoạt động hoàn hảo, mọi câu hỏi đều có căn cứ."
                }
              />
            ) : (
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Câu hỏi gốc</TableHead>
                      <TableHead>Người tạo</TableHead>
                      <TableHead>Lý do</TableHead>
                      <TableHead>Độ tương đồng</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead style={{ textAlign: "right" }}>Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQueue.slice(0, 5).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <strong className="bento-table-lead">
                            {item.original_question}
                          </strong>
                          <small className="bento-table-sub">
                            Mã: {item.id.slice(0, 8)} • Ngày tạo:{" "}
                            {new Date(item.created_at).toLocaleDateString("vi-VN")}
                          </small>
                        </TableCell>
                        <TableCell>{item.creator}</TableCell>
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
                            {getReasonLabel(item.reason_code)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.retrieval_score !== null
                            ? `${Math.round(item.retrieval_score * 100)}%`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "open" || item.status === "new"
                                ? "warning"
                                : item.status === "resolved"
                                ? "success"
                                : "neutral"
                            }
                            size="sm"
                          >
                            {getStatusLabel(item.status)}
                          </Badge>
                        </TableCell>
                        <TableCell style={{ textAlign: "right" }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/unanswered`)}
                          >
                            Xử lý
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
