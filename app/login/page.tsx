"use client";

import { useState, useEffect } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button, Input, Badge } from "@/components/ui";

type Scenario = {
  id: string;
  tabLabel: string;
  icon: string;
  userQuestion: string;
  ragDocTitle: string;
  ragMatchScore: number;
  ragStatus: "verified" | "sensitive" | "missing";
  ragExcerpt: string;
  assistantAnswer: string;
  citationDoc: string;
  actionBadge: {
    label: string;
    variant: "success" | "warning" | "danger" | "brand";
  };
  metrics: {
    latency: string;
    groundedRatio: string;
    sourceCode: string;
  };
};

const SCENARIOS: Scenario[] = [
  {
    id: "dns-domain",
    tabLabel: "Tư vấn DNS tên miền",
    icon: "⚡",
    userQuestion: "Tôi vừa đăng ký tên miền, làm sao để cấu hình trỏ về hosting cPanel ?",
    ragDocTitle: "Hướng dẫn cấu hình DNS tên miền trỏ về Web Hosting",
    ragMatchScore: 96,
    ragStatus: "verified",
    ragExcerpt: "Tạo bản ghi A (@) trỏ về địa chỉ IP của gói hosting; Bản ghi CNAME (www) trỏ về tên miền chính...",
    assistantAnswer:
      "Chào bạn! Để trỏ tên miền về hosting cPanel, bạn vào Quản trị DNS và thiết lập: 1. Bản ghi A (@) trỏ về IP của Hosting [1]. 2. Bản ghi CNAME (www) trỏ về tên miền chính [1]. Thời gian DNS cập nhật toàn cầu từ 15–30 phút.",
    citationDoc: "Kho tri thức : KB-DNS-01 (Đã xác minh bởi Chuyên gia)",
    actionBadge: {
      label: "✓ 96% Có căn cứ",
      variant: "success",
    },
    metrics: {
      latency: "0.34s",
      groundedRatio: "100% tài liệu duyệt",
      sourceCode: "KB-DNS-01",
    },
  },
  {
    id: "pricing-contract",
    tabLabel: "Báo giá & Hợp đồng",
    icon: "💼",
    userQuestion: "Gói Cloud Server Enterprise thanh toán 3 năm có chính sách chiết khấu 35% và xuất HĐ VAT không?",
    ragDocTitle: "Chính sách Báo giá, Hợp đồng & Chiết khấu Doanh nghiệp",
    ragMatchScore: 89,
    ragStatus: "sensitive",
    ragExcerpt: "Chủ đề nhạy cảm [Giá & Hợp đồng] yêu cầu độ tin cậy tối thiểu 90% hoặc chuyển giao Chuyên gia Kinh doanh xác nhận.",
    assistantAnswer:
      "Chính sách chiết khấu hợp đồng dài hạn là nội dung cần sự thẩm định của Bộ phận Kinh doanh. Trợ lý đã tự động chuyển tiếp câu hỏi này cho chuyên gia phụ trách để liên hệ tư vấn chi tiết cho bạn.",
    citationDoc: "Quy chuẩn an toàn: CS-SENSITIVE-90 (Ngưỡng nhạy cảm nghiêm ngặt)",
    actionBadge: {
      label: "⚠️ Nhạy cảm — Chuyển #EXP-842",
      variant: "warning",
    },
    metrics: {
      latency: "0.28s",
      groundedRatio: "Tự động chặn bịa đặt",
      sourceCode: "RULE-SAFE-90",
    },
  },
  {
    id: "missing-knowledge",
    tabLabel: "Chưa có tài liệu",
    icon: "❓",
    userQuestion: " có hỗ trợ cài cắm extension chưa ký số cho cụm Kubernetes nội bộ không?",
    ragDocTitle: "Quét toàn bộ Kho tri thức: Không tìm thấy bài viết khớp",
    ragMatchScore: 31,
    ragStatus: "missing",
    ragExcerpt: "Độ tương đồng cao nhất 31% < ngưỡng tự trả lời 80%. Không có tài liệu nào trong kho được duyệt cho nghiệp vụ này.",
    assistantAnswer:
      "Trợ lý chưa tìm thấy tài liệu chính thức được phê duyệt để giải đáp câu hỏi này. Câu hỏi đã được tự động ghi nhận vào Hàng đợi rà soát (Queue) để chuyên gia kỹ thuật thẩm định và biên soạn tài liệu mới.",
    citationDoc: "Hàng đợi xử lý: Đã ghi nhận phiếu chờ duyệt mới",
    actionBadge: {
      label: "📥 Đưa vào Hàng đợi Queue",
      variant: "brand",
    },
    metrics: {
      latency: "0.19s",
      groundedRatio: "Phát hiện thiếu tài liệu",
      sourceCode: "QUEUE-PENDING",
    },
  },
];

function EvidenceFlow() {
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(3);
  const [showCitationPopup, setShowCitationPopup] = useState(false);

  const scenario = SCENARIOS[selectedScenarioIdx];

  // Auto-play animation cycle
  useEffect(() => {
    // Reset to step 1 then advance
    setStep(1);
    const t1 = setTimeout(() => setStep(2), 1200);
    const t2 = setTimeout(() => setStep(3), 2600);
    const t3 = setTimeout(() => {
      setSelectedScenarioIdx((prev) => (prev + 1) % SCENARIOS.length);
    }, 7000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [selectedScenarioIdx]);

  const selectScenario = (idx: number) => {
    setSelectedScenarioIdx(idx);
    setStep(1);
    setTimeout(() => setStep(2), 600);
    setTimeout(() => setStep(3), 1400);
  };

  return (
    <aside className="bento-login-visual" aria-labelledby="evidence-flow-title">
      <div className="bento-visual-copy">
        <span className="bento-visual-eyebrow">MÔ PHỎNG THỜI GIAN THỰC</span>
        <h2 id="evidence-flow-title">Từ tri thức nội bộ đến phản hồi tin cậy.</h2>
        <p>
          Mọi câu trả lời của trợ lý đều được đối chiếu trực tiếp từ kho tài liệu đã xác minh, 
          tự động nhận diện trường hợp phức tạp để chuyển giao cho chuyên gia.
        </p>
      </div>

      {/* Trình mô phỏng tương tác sinh động */}
      <div className="demo-simulator-container">
        {/* Header giả lập Mac OS */}
        <div className="demo-simulator-header">
          <div className="demo-mac-dots">
            <span className="demo-mac-dot red" />
            <span className="demo-mac-dot yellow" />
            <span className="demo-mac-dot green" />
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", marginLeft: "6px" }}>
              Mô phỏng Luồng AI Grounding
            </span>
          </div>
          <div className="demo-header-badge">
            <span className="demo-pulse-dot" />
            <span>Đang phát trực tiếp</span>
          </div>
        </div>

        {/* Thanh chọn kịch bản tình huống */}
        <div className="demo-scenarios-bar">
          {SCENARIOS.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`demo-scenario-btn ${selectedScenarioIdx === idx ? "active" : ""}`}
              onClick={() => selectScenario(idx)}
            >
              <span>{item.icon}</span>
              <span>{item.tabLabel}</span>
            </button>
          ))}
        </div>

        {/* Khung mô phỏng các bước hoạt động */}
        <div className="demo-stage-body">
          {/* Timeline theo dõi 3 bước */}
          <div className="demo-pipeline-tracker">
            <div
              className="demo-pipeline-progress"
              style={{
                width: step === 1 ? "15%" : step === 2 ? "50%" : "90%",
              }}
            />
            <div className={`demo-pipe-node ${step >= 1 ? (step === 1 ? "active" : "passed") : ""}`}>
              <span>{step > 1 ? "✓" : "1"}</span>
              <span>Nhận câu hỏi</span>
            </div>
            <div className={`demo-pipe-node ${step >= 2 ? (step === 2 ? "active" : "passed") : ""}`}>
              <span>{step > 2 ? "✓" : "2"}</span>
              <span>Đối soát RAG</span>
            </div>
            <div className={`demo-pipe-node ${step === 3 ? "active passed" : ""}`}>
              <span>3</span>
              <span>Ra quyết định</span>
            </div>
          </div>

          {/* Bước 1: Câu hỏi của khách hàng */}
          <div className="demo-bubble-user">
            <div style={{ fontSize: "11px", opacity: 0.85, marginBottom: "2px" }}>
              👤 Khách hàng gửi yêu cầu
            </div>
            <div>{scenario.userQuestion}</div>
          </div>

          {/* Bước 2: Radar quét & đối soát kho tri thức */}
          {step >= 2 && (
            <div className="demo-rag-inspect">
              <div className="demo-radar-sweep" />
              <div className="demo-rag-head">
                <div className="demo-rag-title">
                  <span>🔍</span>
                  <span>Đang đối soát Semantic RAG</span>
                </div>
                <Badge
                  variant={
                    scenario.ragStatus === "verified"
                      ? "success"
                      : scenario.ragStatus === "sensitive"
                      ? "warning"
                      : "danger"
                  }
                  size="sm"
                >
                  {scenario.ragStatus === "verified"
                    ? "Đã xác minh"
                    : scenario.ragStatus === "sensitive"
                    ? "Chủ đề nhạy cảm"
                    : "Thiếu tài liệu"}
                </Badge>
              </div>
              <div className="demo-rag-doc">
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", color: "var(--text-primary)" }}>
                    {scenario.ragDocTitle}
                  </strong>
                  <small style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
                    {scenario.ragExcerpt}
                  </small>
                </div>
                <div className="demo-rag-score">
                  {scenario.ragMatchScore}% Khớp
                </div>
              </div>
            </div>
          )}

          {/* Bước 3: Phản hồi chuẩn mực của Trợ lý AI */}
          {step >= 3 && (
            <div className="demo-bubble-assistant">
              <div className="demo-assistant-head">
                <div className="demo-assistant-avatar">
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      background: "var(--brand-primary)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "12px",
                      fontWeight: "800",
                    }}
                  >
                    AI
                  </div>
                  <span className="demo-assistant-name">Trợ lý AI</span>
                </div>
                <Badge variant={scenario.actionBadge.variant} size="sm">
                  {scenario.actionBadge.label}
                </Badge>
              </div>

              <div style={{ fontSize: "12.5px", lineHeight: "1.6", color: "var(--text-primary)" }}>
                {scenario.assistantAnswer.split("[1]").map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span
                        className="demo-citation-pill"
                        title="Bấm để xem tài liệu nguồn"
                        onClick={() => setShowCitationPopup(!showCitationPopup)}
                      >
                        [1]
                      </span>
                    )}
                  </span>
                ))}
              </div>

              {/* Popup xem chi tiết trích dẫn tài liệu khi bấm [1] */}
              {showCitationPopup && (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "11.5px",
                    color: "#166534",
                  }}
                >
                  <strong>Nguồn trích dẫn:</strong> {scenario.citationDoc}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer đo đạc chỉ số thời gian thực & nút điều khiển */}
        <div className="demo-simulator-footer">
          <div className="demo-stats-row">
            <div className="demo-stat-item">
              <span>⚡ Xử lý:</span>
              <strong>{scenario.metrics.latency}</strong>
            </div>
            <div className="demo-stat-item">
              <span>🛡️ An toàn:</span>
              <strong>{scenario.metrics.groundedRatio}</strong>
            </div>
            <div className="demo-stat-item">
              <span>📚 Mã:</span>
              <strong>{scenario.metrics.sourceCode}</strong>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [resetStep, setResetStep] = useState<"email" | "code" | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState("");

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identity,
        password,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        setError(Number.isFinite(retryAfter) && retryAfter > 0
          ? `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(retryAfter / 60)} phút.`
          : "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.");
        return;
      }
      setError("Tên đăng nhập hoặc mật khẩu không hợp lệ.");
      return;
    }
    if (body.mfaRequired) {
      setMfaRequired(true);
      return;
    }
    window.location.assign("/");
  };

  const verifyMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: mfaCode }),
    });
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "Mã xác thực không đúng.");
      return;
    }
    window.location.assign("/");
  };

  const requestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/password-reset/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: resetEmail }) });
    const body = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) { setError(body.error ?? "Không thể gửi mã xác thực."); return; }
    setResetStep("code"); setError(body.message ?? "Mã xác thực đã được gửi nếu email thuộc tài khoản đang hoạt động.");
  };
  const confirmReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/password-reset/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: resetCode, password: resetPassword, passwordConfirmation: resetPasswordConfirmation }) });
    const body = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) { setError(body.error ?? "Không thể đặt lại mật khẩu."); return; }
    setResetStep(null); setResetCode(""); setResetPassword(""); setResetPasswordConfirmation(""); setError("Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.");
  };

  return (
    <main className="bento-login-page">
      <section className="bento-login-card" aria-labelledby="login-title">
        <div className="bento-login-header">
          <div className="bento-login-brand">
            <BrandMark />
            <div>
              <strong>Trợ lý phản hồi</strong>
              <small>Hệ thống vận hành tri thức</small>
            </div>
          </div>
          <Badge variant="success" dot pulse size="sm">
            Hệ thống ổn định
          </Badge>
        </div>

        {mfaRequired ? (
          <>
            <h1 id="login-title" className="bento-login-title">
              Xác thực hai bước
            </h1>
            <p className="bento-login-subtitle">
              Mở ứng dụng xác thực trên thiết bị của bạn và nhập mã xác minh 6 chữ số.
            </p>

            <form onSubmit={verifyMfa} className="bento-login-form">
              <Input
                label="Mã xác thực 6 số"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(event) =>
                  setMfaCode(event.target.value.replace(/\D/g, ""))
                }
                placeholder="123456"
                required
                autoFocus
              />

              {error && (
                <div className="bento-login-error" role="alert">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={loading}
                disabled={loading || mfaCode.length !== 6}
                className="bento-submit-btn"
              >
                Xác thực và đăng nhập
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  setMfaRequired(false);
                  setMfaCode("");
                  setError("");
                }}
              >
                ← Quay lại đăng nhập
              </Button>
            </form>
          </>
        ) : resetStep ? (
          <>
            <h1 id="login-title" className="bento-login-title">Đặt lại mật khẩu</h1>
            <p className="bento-login-subtitle">{resetStep === "email" ? "Nhập email tài khoản để nhận mã OTP 6 số." : "Nhập mã OTP và mật khẩu mới. Mã có hiệu lực trong 10 phút."}</p>
            <form onSubmit={resetStep === "email" ? requestReset : confirmReset} className="bento-login-form">
              {resetStep === "email" ? <Input label="Email tài khoản" type="email" autoComplete="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} required autoFocus /> : <>
                <Input label="Mã OTP 6 số" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, ""))} required autoFocus />
                <Input label="Mật khẩu mới" type="password" autoComplete="new-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} required />
                <Input label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" value={resetPasswordConfirmation} onChange={(event) => setResetPasswordConfirmation(event.target.value)} required />
              </>}
              {error && <div className="bento-login-error" role="alert"><span>{error}</span></div>}
              <Button type="submit" variant="primary" size="lg" isLoading={loading} disabled={loading || (resetStep === "code" && (resetCode.length !== 6 || !resetPassword || !resetPasswordConfirmation))} className="bento-submit-btn">{resetStep === "email" ? "Gửi mã xác thực" : "Xác nhận đặt lại mật khẩu"}</Button>
              <Button type="button" variant="ghost" size="md" onClick={() => { setResetStep(null); setError(""); }}>← Quay lại đăng nhập</Button>
            </form>
          </>
        ) : (
          <>
            <h1 id="login-title" className="bento-login-title">
              Đăng nhập không gian làm việc
            </h1>
            <p className="bento-login-subtitle">
              Truy cập trợ lý thông minh và tra cứu tri thức nội bộ đã được kiểm duyệt.
            </p>

            <form onSubmit={login} className="bento-login-form">
              <Input
                label="Email hoặc tên đăng nhập"
                name="identity"
                value={identity}
                onChange={(event) => setIdentity(event.target.value)}
                autoComplete="username"
                placeholder="ban@congty.vn hoặc nguyenvana"
                required
              />

              <Input
                label="Mật khẩu"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu của bạn"
                required
              />

              {error && (
                <div className="bento-login-error" role="alert">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="bento-login-options">
                <label className="bento-checkbox-label">
                  <input type="checkbox" name="remember" />
                  <span>Ghi nhớ thiết bị này</span>
                </label>
                <button
                  type="button"
                  className="bento-forgot-link"
                  onClick={() => { setResetStep("email"); setError(""); }}
                >
                  Quên mật khẩu?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={loading}
                disabled={loading}
                className="bento-submit-btn"
              >
                Đăng nhập hệ thống →
              </Button>
            </form>
          </>
        )}

        <div className="bento-login-footer">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
              clipRule="evenodd"
            />
          </svg>
          <span>Thông tin đăng nhập được mã hóa và bảo vệ tại máy chủ</span>
        </div>
      </section>

      <EvidenceFlow />
    </main>
  );
}
