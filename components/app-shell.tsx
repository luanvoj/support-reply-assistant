"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { NavigationIcon } from "@/components/navigation-icon";
import { UserAvatar } from "@/components/user-avatar";

export type Screen = "overview" | "guide" | "assistant" | "conversations" | "knowledge" | "queue" | "review" | "settings" | "profile";

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

type ConfirmOptions = { title: string; description: string; confirmLabel: string; tone?: "default" | "danger"; requiredValue?: string };
type FeedbackApi = { notify: (message: string, tone?: "success" | "error" | "info") => void; confirm: (options: ConfirmOptions) => Promise<boolean> };
const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("Feedback provider is missing");
  return value;
}

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (accepted: boolean) => void }) | null>(null);
  const [typedValue, setTypedValue] = useState("");
  const notify: FeedbackApi["notify"] = (message, tone = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast((current) => current?.message === message ? null : current), 4500);
  };
  const confirm: FeedbackApi["confirm"] = (options) => new Promise((resolve) => { setTypedValue(""); setDialog({ ...options, resolve }); });
  const closeDialog = (accepted: boolean) => {
    if (!dialog || (accepted && dialog.requiredValue && typedValue !== dialog.requiredValue)) return;
    dialog.resolve(accepted); setDialog(null);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && dialog?.tone !== "danger") closeDialog(false); };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog, typedValue]);
  return <FeedbackContext.Provider value={{ notify, confirm }}>{children}{toast && <div className={`app-toast ${toast.tone}`} role="status"><span>{toast.message}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setToast(null)}>×</button></div>}{dialog && <div className="app-modal-backdrop" role="presentation" onMouseDown={() => dialog.tone !== "danger" && closeDialog(false)}><section className={`app-modal ${dialog.tone ?? "default"}`} role="dialog" aria-modal="true" aria-labelledby="app-modal-title" onMouseDown={(event) => event.stopPropagation()}><small>{dialog.tone === "danger" ? "THAO TÁC KHÔNG THỂ KHÔI PHỤC" : "XÁC NHẬN THAO TÁC"}</small><h2 id="app-modal-title">{dialog.title}</h2><p>{dialog.description}</p>{dialog.requiredValue && <label>Nhập đúng tiêu đề để xác nhận<input autoFocus value={typedValue} onChange={(event) => setTypedValue(event.target.value)} placeholder={dialog.requiredValue} /></label>}<div className="app-modal-actions"><button className="ops-button" onClick={() => closeDialog(false)}>Hủy</button><button className={`ops-button ${dialog.tone === "danger" ? "danger" : "primary"}`} disabled={Boolean(dialog.requiredValue && typedValue !== dialog.requiredValue)} onClick={() => closeDialog(true)}>{dialog.confirmLabel}</button></div></section></div>}</FeedbackContext.Provider>;
}

function ShellContent({ screen, children }: { screen: Screen; children: ReactNode }) {
  const { notify } = useFeedback();
  const [viewerRole, setViewerRole] = useState<"sales" | "technical" | "admin" | null>(null);
  const [viewer, setViewer] = useState<{ fullName: string; roleLabel: string; avatarUrl: string | null } | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { void fetch("/api/auth/me").then((response) => response.ok ? response.json() : null).then((body) => setViewerRole(body?.user?.role ?? null)); }, []);
  useEffect(() => {
    const loadViewer = () => { void fetch("/api/profile").then((response) => response.ok ? response.json() : null).then((body) => setViewer(body?.profile ? { fullName: body.profile.fullName, roleLabel: body.profile.roleLabel, avatarUrl: body.profile.avatarUrl } : null)); };
    loadViewer();
    window.addEventListener("profile-avatar-updated", loadViewer);
    return () => window.removeEventListener("profile-avatar-updated", loadViewer);
  }, []);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeWhenOutside = (event: PointerEvent) => { if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAccountMenuOpen(false); };
    document.addEventListener("pointerdown", closeWhenOutside); document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeWhenOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [accountMenuOpen]);
  const logout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) window.location.assign("/login");
    else notify("Không thể đăng xuất. Hãy thử lại.", "error");
  };
  return <div className="ops-shell"><aside className="ops-sidebar"><a className="ops-brand" href="/"><BrandMark /><b>Trợ lý phản hồi<small>Trung tâm vận hành</small></b></a><a className="new-response" href="/assistant">+ Tạo phản hồi</a><nav className="ops-nav">{navigation.filter(([name]) => viewerRole === null || viewerRole === "admin" || (viewerRole === "technical" ? name !== "Cài đặt" : name === "Tổng quan" || name === "Hướng dẫn sử dụng" || name === "Trợ lý")).map(([name, href, icon]) => <a className={screenLabels[screen] === name || (screen === "review" && name === "Yêu cầu chuyên gia") ? "active" : ""} href={href} key={href}><NavigationIcon name={icon} />{name}</a>)}</nav><div className="ops-side-bottom"><small className="healthy">● Hệ thống tri thức sẵn sàng</small><small>Nhóm: Tất cả</small><div className="sidebar-account-menu-wrap" ref={accountMenuRef}><button className="sidebar-account" type="button" aria-expanded={accountMenuOpen} aria-controls="sidebar-account-menu" aria-haspopup="menu" aria-label="Mở tác vụ tài khoản" onClick={() => setAccountMenuOpen((open) => !open)}><UserAvatar className="sidebar-account-avatar" fullName={viewer?.fullName} src={viewer?.avatarUrl} alt="Ảnh đại diện tài khoản" /><span><b>{viewer?.fullName ?? "Thông tin người dùng"}</b><small>{viewer?.roleLabel ?? "Tài khoản"}</small></span><span className="sidebar-account-chevron" aria-hidden="true">⌄</span></button>{accountMenuOpen && <div className="sidebar-account-menu" id="sidebar-account-menu" role="menu" aria-label="Tác vụ tài khoản"><a href="/profile" role="menuitem" onClick={() => setAccountMenuOpen(false)}>Thông tin người dùng</a><button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); void logout(); }}>Đăng xuất</button></div>}</div></div></aside><main className="ops-main"><header className="ops-topbar app-header"><span>Không gian làm việc <b>/</b> {screenLabels[screen]}</span></header>{children}</main></div>;
}

export function AppShell({ screen, children }: { screen: Screen; children: ReactNode }) {
  return <AppFeedbackProvider><ShellContent screen={screen}>{children}</ShellContent></AppFeedbackProvider>;
}
