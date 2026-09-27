"use client";

import { useState } from "react";

function EvidenceFlow() {
  return (
    <aside className="login-visual" aria-labelledby="evidence-flow-title">
      <div className="visual-copy">
        <p className="visual-eyebrow">PHẢN HỒI CÓ CĂN CỨ</p>
        <h2 id="evidence-flow-title">Từ tri thức đến câu trả lời đáng tin cậy.</h2>
        <p>Mỗi bước được thiết kế để đội ngũ trả lời rõ ràng, nhất quán và biết khi nào cần chuyên gia hỗ trợ.</p>
      </div>
      <div className="visual-diagram">
        <div className="visual-rail" aria-hidden="true"><span /><span /><span /></div>
        <article className="visual-node evidence-node">
          <span className="visual-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4.75h14v14.5H5zM8 9h8M8 12h8M8 15h5" /></svg></span>
          <div><b>Tri thức đã xác minh</b><small>Nguồn được kiểm duyệt</small></div>
        </article>
        <article className="visual-node retrieval-node">
          <span className="visual-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 1.85 5.15L19 10l-5.15 1.85L12 17l-1.85-5.15L5 10l5.15-1.85L12 3Z" /></svg></span>
          <div><b>Truy xuất có căn cứ</b><small>Chọn đúng ngữ cảnh</small></div>
        </article>
        <article className="visual-node response-node">
          <span className="visual-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.25 4.25L19 7" /></svg></span>
          <div><b>Sẵn sàng phản hồi</b><small>Minh bạch và có dẫn nguồn</small></div>
        </article>
      </div>
      <p className="visual-footnote"><span aria-hidden="true" /> Trợ lý chỉ phản hồi trong phạm vi thông tin đã được xác minh.</p>
    </aside>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: form.get("identity"), password: form.get("password") }),
    });
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
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

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand"><span aria-hidden="true">✦</span><b>Trợ lý phản hồi<small>Trung tâm vận hành</small></b></div>
        <span className="system-pill">● Hệ thống hoạt động ổn định</span>
        {mfaRequired ? (
          <>
            <h1 id="login-title">Xác thực hai bước</h1>
            <p className="login-copy">Mở ứng dụng xác thực của bạn và nhập mã gồm 6 chữ số.</p>
            <form onSubmit={verifyMfa}>
              <label>Mã xác thực<input className="login-input" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} required autoFocus /></label>
              {error && <small className="login-error" role="alert">{error}</small>}
              <button className="ops-button primary login-submit" disabled={loading || mfaCode.length !== 6}>{loading ? "Đang xác thực…" : "Xác thực và đăng nhập"}</button>
              <button type="button" className="link-button" onClick={() => { setMfaRequired(false); setMfaCode(""); setError(""); }}>Quay lại đăng nhập</button>
            </form>
          </>
        ) : (
          <>
            <h1 id="login-title">Phản hồi chính xác cho mọi cuộc trao đổi với khách hàng.</h1>
            <p className="login-copy">Đặt câu hỏi hỗ trợ phức tạp và nhận câu trả lời dựa trên tri thức nội bộ đã được xác minh.</p>
            <form onSubmit={login}>
              <label>Email hoặc tên đăng nhập<input className="login-input" name="identity" autoComplete="username" placeholder="ban@congty.vn hoặc nguyenvana" required /></label>
              <label>Mật khẩu<input className="login-input" name="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" required /></label>
              {error && <small className="login-error" role="alert">{error}</small>}
              <div className="login-options">
                <label><input type="checkbox" /> Ghi nhớ thiết bị này</label>
                <button type="button" className="link-button" onClick={() => setError("Hãy liên hệ quản trị viên để được đặt lại mật khẩu.")}>Quên mật khẩu?</button>
              </div>
              <button className="ops-button primary login-submit" disabled={loading}>{loading ? "Đang xác thực…" : "Đăng nhập →"}</button>
            </form>
          </>
        )}
        <small className="security-copy">Thông tin đăng nhập được bảo vệ tại máy chủ</small>
      </section>
      <EvidenceFlow />
    </main>
  );
}
