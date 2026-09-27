"use client";

import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: form.get("identity"), password: form.get("password") }) });
    const body = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) { setError("Tên đăng nhập hoặc mật khẩu không hợp lệ."); return; }
    if (body.mfaRequired) { setMfaRequired(true); return; }
    window.location.assign("/");
  };
  const verifyMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/mfa/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: mfaCode }) });
    const body = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) { setError(body.error ?? "Mã xác thực không đúng."); return; }
    window.location.assign("/");
  };
  return <main className="login-page"><section className="login-card"><div className="login-brand"><span>✦</span><b>Trợ lý phản hồi<small>Trung tâm vận hành</small></b></div><span className="system-pill">● Hệ thống hoạt động ổn định</span>{mfaRequired ? <><h1>Xác thực hai bước</h1><p className="login-copy">Mở ứng dụng xác thực của bạn và nhập mã gồm 6 chữ số.</p><form onSubmit={verifyMfa}><label>Mã xác thực<input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} required autoFocus /></label>{error && <small className="login-error">{error}</small>}<button className="ops-button primary login-submit" disabled={loading || mfaCode.length !== 6}>{loading ? "Đang xác thực…" : "Xác thực và đăng nhập"}</button><button type="button" className="link-button" onClick={() => { setMfaRequired(false); setMfaCode(""); setError(""); }}>Quay lại đăng nhập</button></form></> : <><h1>Phản hồi chính xác cho mọi cuộc trao đổi với khách hàng.</h1><p className="login-copy">Đặt câu hỏi hỗ trợ phức tạp và nhận câu trả lời dựa trên tri thức nội bộ đã được xác minh.</p><form onSubmit={login}><label>Email hoặc tên đăng nhập<input name="identity" autoComplete="username" placeholder="ban@congty.vn hoặc nguyenvana" required /></label><label>Mật khẩu<input name="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" required /></label>{error && <small className="login-error">{error}</small>}<div className="login-options"><label><input type="checkbox" /> Ghi nhớ thiết bị này</label><button type="button" className="link-button" onClick={() => setError("Hãy liên hệ quản trị viên để được đặt lại mật khẩu.")}>Quên mật khẩu?</button></div><button className="ops-button primary login-submit" disabled={loading}>{loading ? "Đang xác thực…" : "Đăng nhập →"}</button><button type="button" className="sso-button" onClick={() => setError("SSO/Okta chưa được cấu hình. Hãy dùng tài khoản nội bộ hoặc liên hệ quản trị viên.")}>Tiếp tục với SSO / Okta</button></form></>}<small className="security-copy">Thông tin đăng nhập được bảo vệ tại máy chủ</small></section><aside className="login-visual"><div className="visual-node">▤<small>Tài liệu đã xác minh</small></div><div className="visual-line" /><div className="visual-node blue">✦<small>Truy xuất có căn cứ</small></div><div className="visual-line" /><div className="visual-node green">✓<small>Sẵn sàng phản hồi</small></div></aside></main>;
}
