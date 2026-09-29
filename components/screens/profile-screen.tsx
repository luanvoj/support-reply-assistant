"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useFeedback } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { passwordChecklist, passwordStrength } from "@/lib/auth/users";
import {
  Card,
  Button,
  Badge,
  Input,
} from "@/components/ui";

function readableApiError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) {
    if (error.includes("Authentication required") || error.includes("Unauthorized"))
      return "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.includes("Permission denied") || error.includes("Forbidden"))
      return "Bạn không có quyền thực hiện thao tác này.";
    return error;
  }
  return fallback;
}

export function ProfileScreen() {
  const { notify } = useFeedback();
  const [profile, setProfile] = useState<{
    fullName: string;
    username: string;
    email: string;
    roleLabel: string;
    avatarUrl: string | null;
    mfaEnabled: boolean;
  } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [mfaDialog, setMfaDialog] = useState<"setup" | "disable" | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{
    qrCodeDataUrl: string;
    uri: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaSaving, setMfaSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setProfile(body?.profile ?? null));
  }, []);

  const rules = passwordChecklist(password);
  const readyForStrength = Object.values(rules).every(Boolean);
  const strength = passwordStrength(password);
  const passwordMatches =
    passwordConfirmation.length > 0 && password === passwordConfirmation;

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setAvatarSaving(true);
    const response = await fetch("/api/profile/avatar", {
      method: "POST",
      body: form,
    });
    const body = await response.json().catch(() => ({}));
    setAvatarSaving(false);
    if (!response.ok) {
      notify(
        readableApiError(body.error, "Không thể cập nhật ảnh đại diện."),
        "error"
      );
      return;
    }
    setProfile((current) =>
      current
        ? { ...current, avatarUrl: `${body.avatarUrl}?v=${Date.now()}` }
        : current
    );
    window.dispatchEvent(new Event("profile-avatar-updated"));
    notify("Đã cập nhật ảnh đại diện.", "success");
  };

  const removeAvatar = async () => {
    setAvatarSaving(true);
    const response = await fetch("/api/profile/avatar", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setAvatarSaving(false);
    if (!response.ok) {
      notify(
        readableApiError(body.error, "Không thể xóa ảnh đại diện."),
        "error"
      );
      return;
    }
    setProfile((current) =>
      current ? { ...current, avatarUrl: null } : current
    );
    window.dispatchEvent(new Event("profile-avatar-updated"));
    notify("Đã xóa ảnh đại diện.", "success");
  };

  const changePassword = async () => {
    setCurrentPasswordError("");
    setSaving(true);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, password, passwordConfirmation }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      const errorMessage = readableApiError(
        body.error,
        "Không thể đổi mật khẩu."
      );
      if (errorMessage === "Mật khẩu hiện tại không đúng.") {
        setCurrentPasswordError(errorMessage);
        return;
      }
      notify(errorMessage, "error");
      return;
    }
    setCurrentPassword("");
    setPassword("");
    setPasswordConfirmation("");
    notify(
      "Đã đổi mật khẩu. Vui lòng đăng nhập lại trên các thiết bị khác.",
      "success"
    );
  };

  const beginMfa = async () => {
    setMfaSaving(true);
    const response = await fetch("/api/profile/mfa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "setup" }),
    });
    const body = await response.json().catch(() => ({}));
    setMfaSaving(false);
    if (!response.ok) {
      notify(
        readableApiError(body.error, "Không thể bắt đầu thiết lập 2FA."),
        "error"
      );
      return;
    }
    setMfaSetup(body);
    setMfaCode("");
    setMfaDialog("setup");
  };

  const verifyMfa = async () => {
    setMfaSaving(true);
    const response = await fetch("/api/profile/mfa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "verify", code: mfaCode }),
    });
    const body = await response.json().catch(() => ({}));
    setMfaSaving(false);
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể bật 2FA."), "error");
      return;
    }
    setProfile((current) =>
      current ? { ...current, mfaEnabled: true } : current
    );
    setMfaDialog(null);
    setMfaSetup(null);
    notify("Đã bật xác thực hai bước.", "success");
  };

  const disableMfa = async () => {
    setMfaSaving(true);
    const response = await fetch("/api/profile/mfa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "disable", currentPassword: mfaPassword }),
    });
    const body = await response.json().catch(() => ({}));
    setMfaSaving(false);
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể tắt 2FA."), "error");
      return;
    }
    setProfile((current) =>
      current ? { ...current, mfaEnabled: false } : current
    );
    setMfaPassword("");
    setMfaDialog(null);
    notify("Đã tắt xác thực hai bước.", "success");
  };

  return (
    <AppShell screen="profile">
      <div className="bento-page-header">
        <div>
          <span className="bento-eyebrow">THÔNG TIN & BẢO MẬT CÁ NHÂN</span>
          <h1 className="bento-page-title">Hồ sơ người dùng</h1>
          <p className="bento-page-desc">
            Quản lý thông tin tài khoản, ảnh đại diện, đổi mật khẩu và bảo mật hai lớp.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: "960px" }}>
        {/* Thẻ Thông tin cá nhân */}
        <Card style={{ padding: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", paddingBottom: "var(--space-5)", borderBottom: "1px solid var(--border-subtle)", marginBottom: "var(--space-5)" }}>
            <button
              className="profile-avatar-trigger"
              type="button"
              aria-label="Thay đổi ảnh đại diện"
              onClick={() => setAvatarDialogOpen(true)}
            >
              <UserAvatar
                className="profile-avatar-large"
                fullName={profile?.fullName}
                src={profile?.avatarUrl}
                alt="Ảnh đại diện hiện tại"
              />
              <span aria-hidden="true">✎</span>
            </button>
            <div>
              <h2 className="ui-card-title" style={{ fontSize: "var(--text-lg)" }}>
                {profile?.fullName ?? "Đang tải thông tin…"}
              </h2>
              <Badge variant="brand" size="sm" style={{ marginTop: "4px" }}>
                {profile?.roleLabel ?? "Tài khoản"}
              </Badge>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
            <Input label="Họ và tên" value={profile?.fullName ?? ""} readOnly style={{ background: "var(--bg-surface-subtle)" }} />
            <Input label="Tên đăng nhập" value={profile?.username ?? ""} readOnly style={{ background: "var(--bg-surface-subtle)" }} />
            <Input label="Địa chỉ Email" value={profile?.email ?? ""} readOnly style={{ background: "var(--bg-surface-subtle)" }} />
            <Input label="Vai trò hệ thống" value={profile?.roleLabel ?? ""} readOnly style={{ background: "var(--bg-surface-subtle)" }} />
          </div>
        </Card>

        {/* Thẻ Đổi mật khẩu */}
        <Card style={{ padding: "var(--space-6)" }}>
          <div style={{ marginBottom: "var(--space-5)" }}>
            <h2 className="ui-card-title">Đổi mật khẩu tài khoản</h2>
            <p className="ui-card-description">
              Xác thực bằng mật khẩu hiện tại và tạo mật khẩu mới đạt chuẩn bảo mật doanh nghiệp.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div className="ui-card ui-card-subtle" style={{ padding: "var(--space-4)" }}>
              <h3 className="ui-card-title" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--space-2)" }}>
                Bước 1: Xác thực mật khẩu hiện tại
              </h3>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu hiện tại của bạn"
                value={currentPassword}
                error={currentPasswordError}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setCurrentPasswordError("");
                }}
              />
            </div>

            <div className="ui-card ui-card-subtle" style={{ padding: "var(--space-4)" }}>
              <h3 className="ui-card-title" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--space-2)" }}>
                Bước 2: Đặt mật khẩu mới
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                <Input
                  label="Mật khẩu mới"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập mật khẩu mới"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Input
                  label="Xác nhận mật khẩu mới"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={passwordConfirmation}
                  hint={passwordConfirmation ? (passwordMatches ? "✓ Hai mật khẩu trùng khớp" : "✕ Mật khẩu chưa trùng khớp") : undefined}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                />
              </div>

              <ul className="password-checklist" aria-label="Điều kiện mật khẩu">
                {[
                  [rules.minimumLength, "Tối thiểu 8 ký tự"],
                  [rules.uppercase, "Có ít nhất 1 chữ IN HOA"],
                  [rules.lowercase, "Có ít nhất 1 chữ thường"],
                  [rules.specialCharacter, "Có ký tự đặc biệt (@, #, $, %, !…)"],
                ].map(([passed, label]) => (
                  <li className={passed ? "passed" : ""} key={String(label)}>
                    <span>{passed ? "✓" : "○"}</span>
                    {label}
                  </li>
                ))}
              </ul>

              {readyForStrength && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <Badge variant={strength === "strong" ? "success" : "warning"} size="sm">
                    Độ mạnh mật khẩu: {strength === "strong" ? "Rất mạnh" : "Trung bình"}
                  </Badge>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
              <Button
                variant="primary"
                size="md"
                disabled={
                  saving ||
                  !currentPassword ||
                  !readyForStrength ||
                  !passwordMatches
                }
                onClick={() => void changePassword()}
              >
                {saving ? "Đang áp dụng…" : "Áp dụng mật khẩu mới →"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Thẻ Bảo mật 2FA */}
        <Card style={{ padding: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <h2 className="ui-card-title">Xác thực hai bước (2FA)</h2>
                <Badge variant={profile?.mfaEnabled ? "success" : "neutral"} size="sm">
                  {profile?.mfaEnabled ? "Đang bật" : "Chưa bật"}
                </Badge>
              </div>
              <p className="ui-card-description" style={{ marginTop: "4px" }}>
                {profile?.mfaEnabled
                  ? "Tài khoản của bạn đã được bảo vệ với mã OTP từ ứng dụng xác thực."
                  : "Bật 2FA để nâng cao mức độ an toàn cho tài khoản và hệ thống."}
              </p>
            </div>
            <div>
              <Button
                variant={profile?.mfaEnabled ? "secondary" : "primary"}
                size="md"
                disabled={mfaSaving}
                onClick={() =>
                  profile?.mfaEnabled ? setMfaDialog("disable") : void beginMfa()
                }
              >
                {profile?.mfaEnabled ? "Tắt xác thực hai bước" : "Thiết lập xác thực 2FA →"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal Tải/Đổi Ảnh đại diện */}
      {avatarDialogOpen && (
        <div
          className="ui-modal-backdrop"
          role="presentation"
          onClick={() => !avatarSaving && setAvatarDialogOpen(false)}
        >
          <div
            className="ui-modal ui-modal-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ui-modal-header">
              <span className="ui-modal-eyebrow">ẢNH ĐẠI DIỆN</span>
              <div className="ui-modal-title-row">
                <h2 id="avatar-modal-title" className="ui-modal-title">Cập nhật ảnh đại diện</h2>
                <button type="button" className="ui-modal-close" onClick={() => setAvatarDialogOpen(false)}>✕</button>
              </div>
              <p className="ui-modal-description">Ảnh sẽ được cắt vuông và lưu riêng cho hồ sơ của bạn.</p>
            </div>
            <div className="ui-modal-body">
              <div className="avatar-modal-content">
                <UserAvatar
                  className="avatar-modal-preview"
                  fullName={profile?.fullName}
                  src={profile?.avatarUrl}
                  alt="Xem trước ảnh đại diện"
                />
                <div
                  className="avatar-dropzone"
                  role="button"
                  tabIndex={0}
                  onClick={() => avatarInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      avatarInputRef.current?.click();
                    }
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void uploadAvatar(event.dataTransfer.files[0]);
                  }}
                >
                  <strong>
                    {avatarSaving
                      ? "Đang tải ảnh…"
                      : "Kéo thả ảnh vào đây hoặc bấm để chọn tệp"}
                  </strong>
                  <span>Hỗ trợ JPG, PNG hoặc WebP · Tối đa 5 MB</span>
                </div>
              </div>
              <input
                ref={avatarInputRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  void uploadAvatar(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            <div className="ui-modal-footer">
              <div className="ui-modal-actions">
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  disabled={avatarSaving}
                  onClick={() => setAvatarDialogOpen(false)}
                >
                  Đóng
                </Button>
                {profile?.avatarUrl && (
                  <Button
                    variant="danger"
                    size="md"
                    type="button"
                    disabled={avatarSaving}
                    onClick={() => void removeAvatar()}
                  >
                    Xóa ảnh đại diện
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cài đặt 2FA */}
      {mfaDialog === "setup" && (
        <div className="ui-modal-backdrop" role="presentation">
          <div className="ui-modal ui-modal-md" role="dialog" aria-modal="true" aria-labelledby="mfa-setup-title">
            <div className="ui-modal-header">
              <span className="ui-modal-eyebrow">XÁC THỰC HAI BƯỚC</span>
              <div className="ui-modal-title-row">
                <h2 id="mfa-setup-title" className="ui-modal-title">Quét mã bằng ứng dụng xác thực</h2>
                <button type="button" className="ui-modal-close" onClick={() => { setMfaDialog(null); setMfaSetup(null); }}>✕</button>
              </div>
              <p className="ui-modal-description">
                Sử dụng Google Authenticator, Microsoft Authenticator hoặc ứng dụng OTP tương thích để quét mã QR bên dưới.
              </p>
            </div>
            <div className="ui-modal-body">
              {mfaSetup?.qrCodeDataUrl && (
                <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
                  <img
                    className="mfa-qr"
                    src={mfaSetup.qrCodeDataUrl}
                    alt="Mã QR thiết lập 2FA"
                  />
                </div>
              )}
              <Input
                label="Nhập mã xác thực 6 số hiển thị trên ứng dụng:"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={mfaCode}
                onChange={(event) =>
                  setMfaCode(event.target.value.replace(/\D/g, ""))
                }
                autoFocus
              />
            </div>
            <div className="ui-modal-footer">
              <div className="ui-modal-actions">
                <Button
                  variant="secondary"
                  size="md"
                  disabled={mfaSaving}
                  onClick={() => {
                    setMfaDialog(null);
                    setMfaSetup(null);
                  }}
                >
                  Hủy bỏ
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={mfaSaving || mfaCode.length !== 6}
                  onClick={() => void verifyMfa()}
                >
                  {mfaSaving ? "Đang xác minh…" : "Kích hoạt xác thực 2FA →"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hủy 2FA */}
      {mfaDialog === "disable" && (
        <div className="ui-modal-backdrop" role="presentation">
          <div className="ui-modal ui-modal-sm ui-modal-tone-danger" role="dialog" aria-modal="true" aria-labelledby="mfa-disable-title">
            <div className="ui-modal-header">
              <span className="ui-modal-eyebrow">XÁC NHẬN BẢO MẬT</span>
              <div className="ui-modal-title-row">
                <h2 id="mfa-disable-title" className="ui-modal-title">Tắt xác thực hai bước?</h2>
                <button type="button" className="ui-modal-close" onClick={() => { setMfaDialog(null); setMfaPassword(""); }}>✕</button>
              </div>
              <p className="ui-modal-description">
                Nhập mật khẩu hiện tại để xác nhận tắt 2FA. Tài khoản của bạn sẽ giảm độ an toàn.
              </p>
            </div>
            <div className="ui-modal-body">
              <Input
                label="Mật khẩu hiện tại"
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu để xác nhận"
                value={mfaPassword}
                onChange={(event) => setMfaPassword(event.target.value)}
                autoFocus
              />
            </div>
            <div className="ui-modal-footer">
              <div className="ui-modal-actions">
                <Button
                  variant="secondary"
                  size="md"
                  disabled={mfaSaving}
                  onClick={() => {
                    setMfaDialog(null);
                    setMfaPassword("");
                  }}
                >
                  Hủy bỏ
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  disabled={mfaSaving || !mfaPassword}
                  onClick={() => void disableMfa()}
                >
                  {mfaSaving ? "Đang xử lý…" : "Xác nhận tắt 2FA"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
