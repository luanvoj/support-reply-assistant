"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { BrandMark } from "@/components/brand-mark";
import { NavigationIcon } from "@/components/navigation-icon";
import { Avatar } from "@/components/ui/avatar";
import { Toast, type ToastTone } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";

export type Screen =
  | "overview"
  | "guide"
  | "assistant"
  | "conversations"
  | "knowledge"
  | "queue"
  | "review"
  | "settings"
  | "profile";

const navigation = [
  ["Tổng quan", "/", "overview"],
  ["Hướng dẫn sử dụng", "/guide", "guide"],
  ["Trợ lý", "/assistant", "assistant"],
  ["Hội thoại", "/conversations", "conversations"],
  ["Kho kiến thức", "/knowledge-base", "knowledge"],
  ["Yêu cầu chuyên gia", "/unanswered", "queue"],
  ["Cài đặt", "/settings", "settings"],
] as const;

export const screenLabels: Record<Screen, string> = {
  overview: "Tổng quan",
  guide: "Hướng dẫn sử dụng",
  assistant: "Trợ lý",
  conversations: "Hội thoại",
  knowledge: "Kho kiến thức",
  queue: "Yêu cầu chuyên gia",
  review: "Yêu cầu chuyên gia",
  settings: "Cài đặt",
  profile: "Thông tin người dùng",
};

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  requiredValue?: string;
};

type FeedbackApi = {
  notify: (message: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const fallbackFeedback: FeedbackApi = {
  notify: (message, tone) => {
    if (typeof window !== "undefined") {
      console.log(`[${tone ?? "info"}] ${message}`);
    }
  },
  confirm: async () => false,
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback() {
  const value = useContext(FeedbackContext);
  return value ?? fallbackFeedback;
}

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const existing = useContext(FeedbackContext);
  if (existing) {
    return <>{children}</>;
  }
  return <AppFeedbackProviderInner>{children}</AppFeedbackProviderInner>;
}

function AppFeedbackProviderInner({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [dialog, setDialog] = useState<
    (ConfirmOptions & { resolve: (accepted: boolean) => void }) | null
  >(null);
  const [typedValue, setTypedValue] = useState("");

  const notify: FeedbackApi["notify"] = (message, tone = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  const confirm: FeedbackApi["confirm"] = (options) =>
    new Promise((resolve) => {
      setTypedValue("");
      setDialog({ ...options, resolve });
    });

  const closeDialog = (accepted: boolean) => {
    if (
      !dialog ||
      (accepted &&
        dialog.requiredValue &&
        typedValue.trim() !== dialog.requiredValue.trim())
    )
      return;
    dialog.resolve(accepted);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
      {dialog && (
        <ConfirmDialog
          isOpen={Boolean(dialog)}
          onClose={() => closeDialog(false)}
          onConfirm={() => closeDialog(true)}
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirmLabel}
          tone={dialog.tone}
          requiredValue={dialog.requiredValue}
          typedValue={typedValue}
          onTypedValueChange={setTypedValue}
        />
      )}
    </FeedbackContext.Provider>
  );
}

function ShellContent({
  screen,
  children,
}: {
  screen: Screen;
  children: ReactNode;
}) {
  const { notify } = useFeedback();
  const [viewerRole, setViewerRole] = useState<"sales" | "technical" | "admin" | null>(null);
  const [viewer, setViewer] = useState<{
    fullName: string;
    roleLabel: string;
    avatarUrl: string | null;
  } | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setViewerRole(body?.user?.role ?? null));
  }, []);

  useEffect(() => {
    const loadViewer = () => {
      void fetch("/api/profile")
        .then((response) => (response.ok ? response.json() : null))
        .then((body) =>
          setViewer(
            body?.profile
              ? {
                  fullName: body.profile.fullName,
                  roleLabel: body.profile.roleLabel,
                  avatarUrl: body.profile.avatarUrl,
                }
              : null
          )
        );
    };
    loadViewer();
    window.addEventListener("profile-avatar-updated", loadViewer);
    return () => window.removeEventListener("profile-avatar-updated", loadViewer);
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  const logout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) window.location.assign("/login");
    else notify("Không thể đăng xuất. Hãy thử lại.", "error");
  };

  return (
    <div className="bento-shell">
      {/* Sidebar Điều Hướng Chuẩn Bento */}
      <aside className="bento-sidebar">
        <a
          className="bento-brand"
          href="/"
          title="Trang chủ Trợ lý phản hồi — Hệ thống AI Grounding đang hoạt động"
        >
          <BrandMark />
          <div className="bento-brand-info">
            <strong className="bento-brand-name">Trợ lý phản hồi</strong>
            <div className="bento-brand-status">
              <span className="bento-brand-status-dot" />
              <span className="bento-brand-status-text">AI Grounding Online</span>
              <div className="bento-brand-eq" aria-hidden="true">
                <span className="bento-brand-eq-bar bar-1" />
                <span className="bento-brand-eq-bar bar-2" />
                <span className="bento-brand-eq-bar bar-3" />
              </div>
            </div>
          </div>
        </a>

        <nav className="bento-nav">
          <span className="bento-nav-label">ĐIỀU HƯỚNG</span>
          {navigation
            .filter(([name]) =>
              viewerRole === null ||
              viewerRole === "admin" ||
              (viewerRole === "technical"
                ? name !== "Cài đặt"
                : name === "Tổng quan" ||
                  name === "Hướng dẫn sử dụng" ||
                  name === "Trợ lý")
            )
            .map(([name, href, icon]) => {
              const isActive =
                screenLabels[screen] === name ||
                (screen === "review" && name === "Yêu cầu chuyên gia");
              return (
                <a
                  className={`bento-nav-item ${isActive ? "active" : ""}`}
                  href={href}
                  key={href}
                >
                  <NavigationIcon name={icon} />
                  <span>{name}</span>
                  {isActive && <span className="bento-nav-indicator" />}
                </a>
              );
            })}
        </nav>

        {/* Chân sidebar: Trạng thái hệ thống tinh gọn */}
        <div className="bento-sidebar-footer">
          <div className="bento-system-health">
            <span className="bento-health-dot" />
            <span className="bento-health-text">Hệ thống tri thức sẵn sàng</span>
          </div>
        </div>
      </aside>

      {/* Nội Dung Chính & Topbar */}
      <main className="bento-main">
        <header className="bento-topbar">
          <div className="bento-breadcrumbs">
            <span className="bento-crumb-root">Không gian làm việc</span>
            <span className="bento-crumb-sep">/</span>
            <span className="bento-crumb-current">{screenLabels[screen]}</span>
          </div>

          <div className="bento-topbar-actions">
            {/* Menu Tài khoản Người dùng cao cấp trên Topbar */}
            <div className="bento-topbar-account" ref={accountMenuRef}>
              <button
                className="bento-topbar-user-btn"
                type="button"
                aria-expanded={accountMenuOpen}
                aria-controls="bento-account-menu"
                aria-haspopup="menu"
                aria-label="Mở tác vụ tài khoản"
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <Avatar
                  size="sm"
                  fullName={viewer?.fullName}
                  src={viewer?.avatarUrl}
                  alt="Ảnh đại diện"
                />
                <div className="bento-topbar-user-info">
                  <strong className="bento-topbar-user-name">
                    {viewer?.fullName ?? "Người dùng"}
                  </strong>
                  <span className="bento-topbar-role-pill">
                    {viewer?.roleLabel ?? "Tài khoản"}
                  </span>
                </div>
                <span
                  className={`bento-chevron ${accountMenuOpen ? "open" : ""}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {accountMenuOpen && (
                <div
                  className="bento-account-menu topbar-dropdown"
                  id="bento-account-menu"
                  role="menu"
                  aria-label="Tác vụ tài khoản"
                >
                  <div className="bento-dropdown-user-header">
                    <strong>{viewer?.fullName ?? "Người dùng"}</strong>
                    <small>{viewer?.roleLabel ?? "Tài khoản"}</small>
                  </div>
                  <div className="bento-dropdown-divider" />
                  <a
                    href="/profile"
                    role="menuitem"
                    className="bento-menu-item"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                    </svg>
                    <span>Hồ sơ cá nhân</span>
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    className="bento-menu-item bento-menu-logout"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      void logout();
                    }}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path
                        fillRule="evenodd"
                        d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                        clipRule="evenodd"
                      />
                      <path
                        fillRule="evenodd"
                        d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="bento-content-area">{children}</div>
      </main>
    </div>
  );
}

export function AppShell({
  screen,
  children,
}: {
  screen: Screen;
  children: ReactNode;
}) {
  return (
    <AppFeedbackProvider>
      <ShellContent screen={screen}>{children}</ShellContent>
    </AppFeedbackProvider>
  );
}
