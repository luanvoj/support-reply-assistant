"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavigationIcon } from "@/components/navigation-icon";
import { AppShell } from "@/components/app-shell";

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
    <div className="chart" aria-label="Biểu đồ hoạt động">
      <svg
        viewBox="0 0 720 190"
        role="img"
        aria-label="Xu hướng câu trả lời có căn cứ"
      >
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity=".22" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 148 C50 137 80 145 120 128 S190 118 225 125 S285 112 320 100 S390 108 430 82 S495 88 535 60 S610 68 720 30 L720 190 L0 190Z"
          fill="url(#area)"
        />
        <path
          d="M0 148 C50 137 80 145 120 128 S190 118 225 125 S285 112 320 100 S390 108 430 82 S495 88 535 60 S610 68 720 30"
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M0 173 C70 168 115 172 165 158 S245 166 300 148 S385 153 430 132 S510 143 560 117 S640 128 720 101"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="5 6"
        />
      </svg>
      <div className="chart-axis">
        <span>{period === "Ngày" ? "6 ngày trước" : "00:00"}</span>
        <span>…</span>
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
      fetch("/api/unanswered"),
    ])
      .then(async ([summaryResponse, queueResponse]) => {
        if (summaryResponse.ok)
          setSummary((await summaryResponse.json()).summary ?? {});
        if (queueResponse.ok)
          setQueue((await queueResponse.json()).questions ?? []);
      })
      .catch(() =>
        setNotice("Không thể tải số liệu mới. Hãy kiểm tra kết nối hệ thống."),
      );
  }, []);

  const filteredQueue = useMemo(
    () =>
      queue.filter((item) =>
        `${item.original_question} ${item.creator} ${item.reason_code}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [queue, search],
  );
  return (
    <AppShell screen="overview">
      <div className="dashboard-content">
        <section className="page-heading">
          <div>
            <div className="eyebrow">TỔNG QUAN</div>
            <h1>Vận hành kho kiến thức</h1>
            <p>
              Theo dõi phản hồi có căn cứ, hoạt động nhóm và vòng lặp kiến thức.
            </p>
          </div>
          <div className="heading-actions">
            <button
              className="button secondary"
              onClick={() => router.push("/assistant")}
            >
              Hỏi trợ lý ↗
            </button>
            <button
              className="button primary"
              onClick={() => router.push("/knowledge-base?new=1")}
            >
              + Thêm tài liệu
            </button>
          </div>
        </section>
        {notice && (
          <div className="status-banner">
            <span className="pulse" /> {notice}
            <button className="text-button" onClick={() => setNotice("")}>
              Đóng
            </button>
          </div>
        )}
        <div className="status-banner">
          <span className="pulse" /> Đồng bộ tri thức AI{" "}
          <strong>Đang hoạt động</strong>
          <span className="divider" /> Kho dữ liệu sẵn sàng{" "}
        </div>
        <section className="kpi-grid">
          <article className="kpi-card">
            <div className="kpi-top">
              <span>Hội thoại 30 ngày</span>
              <span className="kpi-icon blue"><NavigationIcon name="conversations" /></span>
            </div>
            <strong>{summary.conversations_30d ?? "—"}</strong>
            <div className="kpi-foot positive">
              Dữ liệu thực <span>từ hệ thống</span>
            </div>
            <small>Đã đồng bộ dashboard</small>
          </article>
          <article className="kpi-card">
            <div className="kpi-top">
              <span>Phản hồi trợ lý</span>
              <span className="kpi-icon green"><NavigationIcon name="assistant" /></span>
            </div>
            <strong>{summary.assistant_messages_30d ?? "—"}</strong>
            <div className="kpi-foot positive">
              Có nguồn tham chiếu <span>khi đủ độ tin cậy</span>
            </div>
            <small>Trong 30 ngày gần nhất</small>
          </article>
          <article className="kpi-card">
            <div className="kpi-top">
              <span>Chờ chuyên gia xử lý</span>
              <span className="kpi-icon amber"><NavigationIcon name="queue" /></span>
            </div>
            <strong>{summary.unanswered_open ?? "—"}</strong>
            <div className="kpi-foot warning">
              Cần rà soát <span>câu hỏi chưa có căn cứ</span>
            </div>
            <small>Đi tới hàng đợi để xử lý</small>
          </article>
          <article className="kpi-card">
            <div className="kpi-top">
              <span>Độ căn cứ trung bình</span>
              <span className="kpi-icon purple"><NavigationIcon name="knowledge" /></span>
            </div>
            <strong>{summary.avg_evidence_30d !== undefined && summary.avg_evidence_30d !== null ? `${Math.round(Number(summary.avg_evidence_30d) * 100)}%` : "—"}</strong>
            <div className="kpi-foot positive">
              Có căn cứ <span>{summary.grounded_answers_30d ?? 0} lượt trong 30 ngày</span>
            </div>
            <small>{summary.escalated_answers_30d ?? 0} lượt cần chuyên gia</small>
          </article>
        </section>
        <section className="content-grid">
          <article className="panel trend-panel">
            <div className="panel-heading">
              <div>
                <h2>Xu hướng hoạt động & độ tin cậy</h2>
                <p>So sánh câu hỏi với phản hồi được xác minh</p>
              </div>
              <div className="segmented">
                {["Giờ", "Ngày", "Tuần"].map((value) => (
                  <button
                    className={period === value ? "selected" : ""}
                    onClick={() => setPeriod(value)}
                    key={value}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <TrendChart period={period} />
            <div className="chart-legend">
              <span>
                <i className="legend-blue" /> Phản hồi có căn cứ
              </span>
              <span>
                <i className="legend-gray" /> Chuyển chuyên gia
              </span>
              <strong>
                Đang theo dõi <small>theo {period.toLowerCase()}</small>
              </strong>
            </div>
          </article>
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Tác vụ cần ưu tiên</h2>
                <p>Các đường tắt để vận hành tri thức</p>
              </div>
              <button
                className="text-button"
                onClick={() => router.push("/knowledge-base")}
              >
                Mở kho kiến thức →
              </button>
            </div>
            <div className="topic-list">
              <button
                className="topic"
                onClick={() => router.push("/unanswered")}
              >
                <span className="topic-number">01</span>
                <div className="topic-copy">
                  <strong>Hàng đợi chưa trả lời</strong>
                  <span>{summary.unanswered_open ?? 0} câu hỏi cần xử lý</span>
                </div>
                <span className="tag tag-technical">Mở</span>
              </button>
              <button
                className="topic"
                onClick={() => router.push("/assistant")}
              >
                <span className="topic-number">02</span>
                <div className="topic-copy">
                  <strong>Đặt câu hỏi cho trợ lý</strong>
                  <span>Nhận phản hồi dựa trên tài liệu đã xuất bản</span>
                </div>
                <span className="tag tag-support">Hỏi</span>
              </button>
              <button
                className="topic"
                onClick={() => router.push("/settings")}
              >
                <span className="topic-number">03</span>
                <div className="topic-copy">
                  <strong>Cấu hình nhà cung cấp AI</strong>
                  <span>
                    {summary.enabled_providers ?? 0} nhà cung cấp đang bật
                  </span>
                </div>
                <span className="tag tag-admin">Cài đặt</span>
              </button>
            </div>
          </article>
        </section>
        <section className="panel queue-panel">
          <div className="panel-heading queue-heading">
            <div>
              <h2>
                Hàng đợi chưa trả lời{" "}
                <span className="count-badge">{filteredQueue.length}</span>
              </h2>
              <p>Câu hỏi đang chờ câu trả lời kỹ thuật đã xác minh</p>
            </div>
            <div className="range-actions">
              <button
                className="button secondary small"
                onClick={() => router.push("/unanswered")}
              >
                Mở hàng đợi →
              </button>
            </div>
          </div>
          <div className="filter-row">
            <label className="dashboard-queue-search">
              <span>Tìm trong hàng đợi</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm câu hỏi, người gửi hoặc nguyên nhân"
              />
            </label>
            <button className="filter active">
              Tất cả <span>{queue.length}</span>
            </button>
            <button
              className="filter"
              onClick={() => router.push("/unanswered?status=new")}
            >
              Mới{" "}
              <span>
                {queue.filter((item) => item.status === "new").length}
              </span>
            </button>
            <button
              className="filter"
              onClick={() => router.push("/unanswered?status=in_review")}
            >
              Đang xử lý
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Câu hỏi / phiếu</th>
                  <th>Người gửi</th>
                  <th>Độ tin cậy</th>
                  <th>Nguyên nhân</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredQueue.length ? (
                  filteredQueue.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.original_question}</strong>
                        <span className="ticket-id">
                          {item.id.slice(0, 8)} ·{" "}
                          {new Date(item.created_at).toLocaleString("vi-VN")}
                        </span>
                      </td>
                      <td>{item.creator}</td>
                      <td>
                        <span className="confidence">
                          {Math.round((item.retrieval_score ?? 0) * 100)}%
                        </span>
                      </td>
                      <td>
                        <span className="category">
                          {item.reason_code === "missing_knowledge"
                            ? "Thiếu tài liệu"
                            : "Độ tin cậy thấp"}
                        </span>
                      </td>
                      <td>
                        <span className="status status-amber">
                          {item.status === "new" ? "Mới" : item.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="row-action"
                          onClick={() => router.push(`/review?id=${item.id}`)}
                        >
                          Rà soát →
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>Chưa có câu hỏi nào trong hàng đợi.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel articles-panel">
          <div className="panel-heading">
            <div>
              <h2>Kho kiến thức</h2>
              <p>Tạo, rà soát và xuất bản nguồn cho trợ lý</p>
            </div>
            <button
              className="text-button"
              onClick={() => router.push("/knowledge-base")}
            >
              Duyệt bài viết →
            </button>
          </div>
          <div className="article-grid">
            <article className="article-card">
              <div className="article-icon"><NavigationIcon name="knowledge" /></div>
              <div>
                <strong>Thêm bài viết mới</strong>
                <span>Chia nhỏ và lập chỉ mục tự động</span>
                <small>
                  Sẵn sàng tạo <b>•</b> Có phân quyền
                </small>
              </div>
              <button
                onClick={() => router.push("/knowledge-base?new=1")}
                aria-label="Thêm bài viết"
              >
                ↗
              </button>
            </article>
            <article className="article-card">
              <div className="article-icon"><NavigationIcon name="queue" /></div>
              <div>
                <strong>Rà soát câu hỏi chờ</strong>
                <span>Xuất bản câu trả lời đã được duyệt</span>
                <small>
                  {summary.unanswered_open ?? 0} tác vụ <b>•</b> Cần xử lý
                </small>
              </div>
              <button
                onClick={() => router.push("/unanswered")}
                aria-label="Mở hàng đợi"
              >
                ↗
              </button>
            </article>
            <article className="article-card">
              <div className="article-icon"><NavigationIcon name="settings" /></div>
              <div>
                <strong>Nhà cung cấp AI</strong>
                <span>Quản lý kết nối và chuyển đổi dự phòng</span>
                <small>{summary.enabled_providers ?? 0} đang bật</small>
              </div>
              <button
                onClick={() => router.push("/settings")}
                aria-label="Mở cài đặt"
              >
                ↗
              </button>
            </article>
          </div>
        </section>
        <footer className="footer-note">
          <span>Trợ lý phản hồi v0.1</span>
          <span>Kho tri thức được lập chỉ mục tự động</span>
        </footer>
      </div>
    </AppShell>
  );
}
