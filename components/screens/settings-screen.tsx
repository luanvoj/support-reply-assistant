"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useFeedback } from "@/components/app-shell";
import { passwordChecklist, passwordStrength } from "@/lib/auth/users";
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
  Select,
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  BentoSelect,
} from "@/components/ui";

function readableApiError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) {
    if (error.includes("Authentication required") || error.includes("Unauthorized"))
      return "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.includes("Permission denied") || error.includes("Forbidden"))
      return "Bạn không có quyền thực hiện thao tác này.";
    if (error.includes("Network") || error.includes("fetch"))
      return "Lỗi kết nối mạng. Hãy kiểm tra kết nối hệ thống.";
    return error;
  }
  return fallback;
}

type ManagedUser = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: "sales" | "technical" | "admin";
  roleLabel: string;
  status: "active" | "disabled" | "purged";
  mfaEnabled: boolean;
};

type OperationalLogRow = {
  id: string;
  category: "account" | "authentication" | "knowledge" | "configuration";
  summary: string;
  created_at: string;
  details: Record<string, unknown>;
};

// -------------------------------------------------------------
// Component con: Quản lý người dùng
// -------------------------------------------------------------
function UserManagementSection() {
  const { notify, confirm } = useFeedback();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    passwordConfirmation: "",
    role: "sales",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [successorId, setSuccessorId] = useState("");
  const [deleteCandidates, setDeleteCandidates] = useState<ManagedUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emailError, setEmailError] = useState("");

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    return fetch("/api/users?" + params.toString())
      .then(async (response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => {
        setUsers(body.users ?? []);
        setPagination(body.pagination ?? { page: 1, pageSize: 20, total: 0 });
      })
      .catch(() => notify("Không thể tải danh sách người dùng.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setCurrentUserId(body?.user?.userId ?? null));
  }, []);

  const createUser = async () => {
    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Nhập một địa chỉ email hợp lệ.");
      return;
    }
    setEmailError("");
    setSaving(true);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể tạo người dùng."), "error");
      return;
    }
    setForm({
      fullName: "",
      username: "",
      email: "",
      password: "",
      passwordConfirmation: "",
      role: "sales",
    });
    setFormOpen(false);
    notify("Đã tạo người dùng mới thành công.", "success");
    load();
  };

  const updateUser = async () => {
    if (!editingId) return;
    setSaving(true);
    const response = await fetch(`/api/users/${editingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể cập nhật người dùng."), "error");
      return;
    }
    setFormOpen(false);
    setEditingId(null);
    setForm({
      fullName: "",
      username: "",
      email: "",
      password: "",
      passwordConfirmation: "",
      role: "sales",
    });
    notify("Đã cập nhật thông tin người dùng.", "success");
    load();
  };

  const disableUser = async (user: ManagedUser) => {
    if (
      !(await confirm({
        title: `Vô hiệu hóa ${user.fullName}?`,
        description:
          "Tài khoản sẽ không thể đăng nhập cho đến khi được kích hoạt lại. Mọi dữ liệu và bảo mật 2FA vẫn được giữ nguyên.",
        confirmLabel: "Vô hiệu hóa",
        tone: "danger",
      }))
    )
      return;
    const response = await fetch(`/api/users/${user.id}/disable`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể vô hiệu hóa người dùng."), "error");
      return;
    }
    notify("Đã vô hiệu hóa tài khoản người dùng.", "success");
    load();
  };

  const restoreUser = async (user: ManagedUser) => {
    if (
      !(await confirm({
        title: `Kích hoạt lại ${user.fullName}?`,
        description: "Tài khoản sẽ có thể đăng nhập lại bình thường.",
        confirmLabel: "Kích hoạt lại",
        tone: "default",
      }))
    )
      return;
    const response = await fetch(`/api/users/${user.id}/restore`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể kích hoạt lại tài khoản."), "error");
      return;
    }
    notify("Đã kích hoạt lại tài khoản.", "success");
    load();
  };

  const openDelete = async (user: ManagedUser) => {
    const response = await fetch(`/api/users/${user.id}/deletion-candidates`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể tải tài khoản kế thừa."), "error");
      return;
    }
    setDeleteCandidates(body.candidates ?? []);
    setSuccessorId("");
    setDeleteTarget(user);
  };

  const deleteUser = async () => {
    if (!deleteTarget || !successorId) return;
    const response = await fetch(`/api/users/${deleteTarget.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ successorId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể xóa tài khoản."), "error");
      return;
    }
    setDeleteTarget(null);
    setDeleteCandidates([]);
    setSuccessorId("");
    notify("Đã xóa vĩnh viễn tài khoản và bàn giao trách nhiệm.", "success");
    load();
  };

  const resetUserPassword = async () => {
    if (!editingId) return;
    setSaving(true);
    const response = await fetch(`/api/users/${editingId}/password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        password: form.password,
        passwordConfirmation: form.passwordConfirmation,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể đặt lại mật khẩu."), "error");
      return;
    }
    setForm({ ...form, password: "", passwordConfirmation: "" });
    notify("Đã đặt lại mật khẩu và thu hồi các phiên đăng nhập cũ.", "success");
  };

  const disableUserMfa = async (user: ManagedUser) => {
    if (
      !(await confirm({
        title: `Tắt 2FA của ${user.fullName}?`,
        description: "Người dùng sẽ cần đăng nhập lại và cài đặt 2FA mới.",
        confirmLabel: "Tắt 2FA",
        tone: "danger",
      }))
    )
      return;
    setSaving(true);
    const response = await fetch(`/api/users/${user.id}/mfa`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể tắt 2FA."), "error");
      return;
    }
    notify("Đã tắt 2FA của người dùng thành công.", "success");
    load();
  };

  const newUserPasswordRules = passwordChecklist(form.password);
  const newUserPasswordReady = Object.values(newUserPasswordRules).every(Boolean);
  const newUserPasswordsMatch =
    form.passwordConfirmation.length > 0 && form.password === form.passwordConfirmation;
  const newUserPasswordStrength = passwordStrength(form.password);
  const editingUser = users.find((user) => user.id === editingId);
  const canRecoverEditingUser = Boolean(
    editingUser &&
      currentUserId &&
      editingUser.id !== currentUserId &&
      editingUser.status === "active",
  );

  return (
    <div>
      {/* Modal Xóa tài khoản */}
      {deleteTarget && (
        <div className="ui-modal-backdrop" role="presentation">
          <div className="ui-modal ui-modal-md ui-modal-tone-danger" role="dialog" aria-modal="true">
            <div className="ui-modal-header">
              <span className="ui-modal-eyebrow">XÓA TÀI KHOẢN VĨNH VIỄN</span>
              <div className="ui-modal-title-row">
                <h2 className="ui-modal-title">Xóa tài khoản {deleteTarget.fullName}</h2>
                <button type="button" className="ui-modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
              </div>
              <p className="ui-modal-description">
                Hành động không thể hoàn tác. Chọn tài khoản kế thừa để chuyển giao tài liệu và dữ liệu vận hành.
              </p>
            </div>
            <div className="ui-modal-body">
              <BentoSelect
                label="Chọn tài khoản kế thừa"
                value={successorId}
                placeholder="Chọn người nhận bàn giao…"
                options={[
                  { value: "", label: "Chọn người nhận bàn giao…" },
                  ...deleteCandidates.map((c) => ({
                    value: c.id,
                    label: `${c.fullName} (${c.roleLabel})`,
                  })),
                ]}
                onChange={(val) => setSuccessorId(val)}
              />
            </div>
            <div className="ui-modal-footer">
              <div className="ui-modal-actions">
                <Button variant="secondary" size="md" onClick={() => setDeleteTarget(null)}>
                  Hủy
                </Button>
                <Button variant="danger" size="md" disabled={!successorId} onClick={() => void deleteUser()}>
                  Xác nhận xóa tài khoản
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tạo/Sửa người dùng */}
      {formOpen && (
        <div className="ui-modal-backdrop" role="presentation">
          <div className="ui-modal ui-modal-lg" role="dialog" aria-modal="true">
            <div className="ui-modal-header">
              <span className="ui-modal-eyebrow">QUẢN LÝ TÀI KHOẢN</span>
              <div className="ui-modal-title-row">
                <h2 className="ui-modal-title">{editingId ? "Điều chỉnh tài khoản" : "Tạo người dùng mới"}</h2>
                <button type="button" className="ui-modal-close" onClick={() => setFormOpen(false)}>✕</button>
              </div>
            </div>
            <div className="ui-modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input
                  label="Họ và tên"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
                <Input
                  label="Tên đăng nhập"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
                <Input
                  label="Email liên hệ"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  error={emailError}
                  hint="Bắt buộc, dùng một địa chỉ email hợp lệ và chưa được sử dụng."
                  onChange={(e) => {
                    setEmailError("");
                    setForm({ ...form, email: e.target.value });
                  }}
                />
                <BentoSelect
                  label="Vai trò hệ thống"
                  value={form.role}
                  options={[
                    { value: "sales", label: "Người dùng (Tư vấn viên)" },
                    { value: "technical", label: "Chuyên gia (Kiểm định viên)" },
                    { value: "admin", label: "Quản trị viên hệ thống" },
                  ]}
                  onChange={(val) => setForm({ ...form, role: val as "sales" | "technical" | "admin" })}
                />
              </div>

              {!editingId && (
                <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "1rem" }}>
                  <strong style={{ display: "block", marginBottom: "0.75rem" }}>Thiết lập mật khẩu khởi tạo</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
                    <Input
                      label="Mật khẩu"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nhập mật khẩu"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <Input
                      label="Nhập lại mật khẩu"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu"
                      value={form.passwordConfirmation}
                      hint={form.passwordConfirmation ? (newUserPasswordsMatch ? "✓ Hai mật khẩu trùng khớp" : "✕ Mật khẩu chưa trùng khớp") : undefined}
                      onChange={(e) => setForm({ ...form, passwordConfirmation: e.target.value })}
                    />
                  </div>

                  <ul className="password-checklist" aria-label="Điều kiện mật khẩu">
                    {[
                      [newUserPasswordRules.minimumLength, "Tối thiểu 8 ký tự"],
                      [newUserPasswordRules.uppercase, "Có ít nhất 1 chữ IN HOA"],
                      [newUserPasswordRules.lowercase, "Có ít nhất 1 chữ thường"],
                      [newUserPasswordRules.specialCharacter, "Có ký tự đặc biệt (@, #, $, %, !…)"],
                    ].map(([passed, label]) => (
                      <li className={passed ? "passed" : ""} key={String(label)}>
                        <span>{passed ? "✓" : "○"}</span>
                        {label}
                      </li>
                    ))}
                  </ul>

                  {newUserPasswordReady && (
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <Badge variant={newUserPasswordStrength === "strong" ? "success" : "warning"} size="sm">
                        Độ mạnh mật khẩu: {newUserPasswordStrength === "strong" ? "Rất mạnh" : "Trung bình"}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {editingId && canRecoverEditingUser && (
                <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "1rem" }}>
                  <strong style={{ display: "block", marginBottom: "0.75rem" }}>Bảo mật & Cấp lại quyền</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
                    <Input
                      label="Mật khẩu mới (nếu muốn đặt lại)"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nhập mật khẩu mới"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <Input
                      label="Nhập lại mật khẩu mới"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu mới"
                      value={form.passwordConfirmation}
                      hint={form.passwordConfirmation ? (newUserPasswordsMatch ? "✓ Hai mật khẩu trùng khớp" : "✕ Mật khẩu chưa trùng khớp") : undefined}
                      onChange={(e) => setForm({ ...form, passwordConfirmation: e.target.value })}
                    />
                  </div>

                  <ul className="password-checklist" aria-label="Điều kiện mật khẩu">
                    {[
                      [newUserPasswordRules.minimumLength, "Tối thiểu 8 ký tự"],
                      [newUserPasswordRules.uppercase, "Có ít nhất 1 chữ IN HOA"],
                      [newUserPasswordRules.lowercase, "Có ít nhất 1 chữ thường"],
                      [newUserPasswordRules.specialCharacter, "Có ký tự đặc biệt (@, #, $, %, !…)"],
                    ].map(([passed, label]) => (
                      <li className={passed ? "passed" : ""} key={String(label)}>
                        <span>{passed ? "✓" : "○"}</span>
                        {label}
                      </li>
                    ))}
                  </ul>

                  {newUserPasswordReady && (
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <Badge variant={newUserPasswordStrength === "strong" ? "success" : "warning"} size="sm">
                        Độ mạnh mật khẩu: {newUserPasswordStrength === "strong" ? "Rất mạnh" : "Trung bình"}
                      </Badge>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving || !newUserPasswordReady || !newUserPasswordsMatch}
                      onClick={() => void resetUserPassword()}
                    >
                      Đặt lại mật khẩu này
                    </Button>
                    {editingUser?.mfaEnabled && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={saving}
                        onClick={() => void disableUserMfa(editingUser)}
                      >
                        Tắt xác thực 2FA của người dùng
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="ui-modal-footer">
              <div className="ui-modal-actions">
                <Button variant="secondary" size="md" onClick={() => setFormOpen(false)}>
                  Hủy
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={
                    saving ||
                    (!editingId && (!newUserPasswordReady || !newUserPasswordsMatch || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())))
                  }
                  onClick={() => void (editingId ? updateUser() : createUser())}
                >
                  {saving ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Tạo tài khoản"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar & Bảng danh sách người dùng */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <CardTitle>Danh sách tài khoản ({pagination.total})</CardTitle>
              <CardDescription>Quản lý người dùng, phân quyền và kiểm soát bảo mật đăng nhập.</CardDescription>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setEditingId(null);
                setForm({
                  fullName: "",
                  username: "",
                  email: "",
                  password: "",
                  passwordConfirmation: "",
                  role: "sales",
                });
                setEmailError("");
                setFormOpen(true);
              }}
            >
              + Thêm người dùng
            </Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px", gap: "0.75rem", marginTop: "1rem" }}>
            <Input
              placeholder="Tìm theo tên, email, username…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <BentoSelect
              value={roleFilter}
              placeholder="Tất cả vai trò"
              minWidth="160px"
              options={[
                { value: "", label: "Tất cả vai trò" },
                { value: "admin", label: "Quản trị viên" },
                { value: "technical", label: "Chuyên gia" },
                { value: "sales", label: "Người dùng" },
              ]}
              onChange={(val) => {
                setRoleFilter(val);
                setPage(1);
              }}
            />
            <BentoSelect
              value={statusFilter}
              placeholder="Tất cả trạng thái"
              minWidth="160px"
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "active", label: "Đang hoạt động" },
                { value: "disabled", label: "Đã vô hiệu hóa" },
              ]}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
              Đang tải danh sách người dùng…
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              title="Không tìm thấy người dùng"
              description="Không có tài khoản nào khớp với bộ lọc tìm kiếm hiện tại."
            />
          ) : (
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Họ tên / Tên đăng nhập</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Bảo mật 2FA</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead style={{ textAlign: "right" }}>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <strong className="bento-table-lead">{user.fullName}</strong>
                        <small className="bento-table-sub">
                          @{user.username} • {user.email}
                        </small>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" size="sm">
                          {user.roleLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.mfaEnabled ? "success" : "neutral"} size="sm">
                          {user.mfaEnabled ? "Đã bật 2FA" : "Chưa bật"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "success" : "warning"} size="sm">
                          {user.status === "active" ? "Đang hoạt động" : "Đã khóa"}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.375rem" }}>
                          {user.status === "active" ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingId(user.id);
                                  setForm({
                                    fullName: user.fullName,
                                    username: user.username,
                                    email: user.email,
                                    password: "",
                                    passwordConfirmation: "",
                                    role: user.role,
                                  });
                                  setFormOpen(true);
                                }}
                              >
                                Sửa
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => void disableUser(user)}>
                                Khóa
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => void openDelete(user)}>
                                Xóa…
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => void restoreUser(user)}>
                              Mở khóa
                            </Button>
                          )}
                        </div>
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
  );
}

// -------------------------------------------------------------
// Component con: Chi tiết sự kiện Nhật ký Bento
// -------------------------------------------------------------
function LogEventDetail({
  details,
  category,
}: {
  details: Record<string, unknown>;
  category: OperationalLogRow["category"];
}) {
  const [showRaw, setShowRaw] = useState(false);

  // Phân tích đối tượng bài viết (knowledge)
  const articleTitle =
    typeof details.title === "string"
      ? details.title
      : typeof details.article_title === "string"
        ? details.article_title
        : typeof details.slug === "string"
          ? details.slug
          : null;
  const articleId =
    typeof details.articleId === "string"
      ? details.articleId
      : typeof details.id === "string"
        ? details.id
        : null;

  // Phân tích đối tượng người dùng (account / authentication)
  const targetEmail =
    typeof details.target_email === "string"
      ? details.target_email
      : typeof details.email === "string"
        ? details.email
        : typeof details.username === "string"
          ? details.username
          : null;
  const targetRole =
    typeof details.role === "string"
      ? details.role
      : typeof details.target_role === "string"
        ? details.target_role
        : null;

  // Phân tích đối tượng cấu hình (configuration)
  const providerId =
    typeof details.providerId === "string"
      ? details.providerId
      : typeof details.provider === "string"
        ? details.provider
        : null;
  const retentionDays =
    typeof details.retentionDays === "number" || typeof details.retentionDays === "string"
      ? details.retentionDays
      : null;

  const actorEmail =
    typeof details.actor_email === "string"
      ? details.actor_email
      : typeof details.actor === "string"
        ? details.actor
        : null;

  const ip = typeof details.ip === "string" ? details.ip : null;

  return (
    <div className="bento-log-detail-box">
      {/* 1. Banner đối tượng tác động chính */}
      {articleTitle && (
        <div className="bento-log-target-banner">
          <div className="bento-log-target-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#059669" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="bento-log-target-content">
            <strong>Bài viết tri thức: &ldquo;{articleTitle}&rdquo;</strong>
            <span>
              {articleId && (
                <>
                  Mã định danh: <code className="bento-log-code-chip">{articleId}</code>
                </>
              )}
              {details.category ? ` · Chuyên mục: ${String(details.category)}` : ""}
            </span>
          </div>
        </div>
      )}

      {targetEmail && !articleTitle && (
        <div className="bento-log-target-banner">
          <div className="bento-log-target-icon" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#2563eb" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="bento-log-target-content">
            <strong>Tài khoản tác động: {targetEmail}</strong>
            <span>
              {targetRole && `Vai trò phân quyền: ${targetRole}`}
              {details.status ? ` · Trạng thái: ${String(details.status)}` : ""}
            </span>
          </div>
        </div>
      )}

      {providerId && !articleTitle && !targetEmail && (
        <div className="bento-log-target-banner">
          <div className="bento-log-target-icon" style={{ background: "rgba(139, 92, 246, 0.1)", color: "#7c3aed" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div className="bento-log-target-content">
            <strong>Nhà cung cấp AI: {providerId}</strong>
            <span>{details.model ? `Mô hình: ${String(details.model)}` : "Cấu hình cổng AI / LLM"}</span>
          </div>
        </div>
      )}

      {retentionDays && !articleTitle && !targetEmail && !providerId && (
        <div className="bento-log-target-banner">
          <div className="bento-log-target-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#d97706" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="bento-log-target-content">
            <strong>Chính sách lưu trữ nhật ký: {retentionDays} ngày</strong>
            <span>Hạn lưu vết trước khi hệ thống dọn dẹp tự động</span>
          </div>
        </div>
      )}

      {/* 2. Grid các thông số chi tiết */}
      <div className="bento-log-meta-grid">
        {actorEmail && (
          <div className="bento-log-meta-item">
            <span className="bento-log-meta-label">Người thực hiện</span>
            <span className="bento-log-meta-val">{actorEmail}</span>
          </div>
        )}
        {ip && (
          <div className="bento-log-meta-item">
            <span className="bento-log-meta-label">Địa chỉ IP / Kênh</span>
            <span className="bento-log-meta-val">{ip}</span>
          </div>
        )}
        {Boolean(details.action) && (
          <div className="bento-log-meta-item">
            <span className="bento-log-meta-label">Mã hành động</span>
            <span className="bento-log-meta-val">
              <code className="bento-log-code-chip">{String(details.action)}</code>
            </span>
          </div>
        )}
        {Boolean(details.changes && typeof details.changes === "object") && (
          <div className="bento-log-meta-item" style={{ gridColumn: "1 / -1" }}>
            <span className="bento-log-meta-label">Các thuộc tính cập nhật</span>
            <span className="bento-log-meta-val">
              {Object.keys(details.changes as object).join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* 3. Nút bật/tắt xem JSON kỹ thuật thô */}
      <div style={{ marginTop: "4px" }}>
        <button
          type="button"
          className="bento-log-raw-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setShowRaw(!showRaw);
          }}
        >
          {showRaw ? "▲ Thu gọn dữ liệu kỹ thuật" : "▼ Xem dữ liệu thô (JSON Payload)"}
        </button>
        {showRaw && (
          <pre className="bento-log-raw-pre">
            {JSON.stringify(details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component con: Nhật ký vận hành / kiểm toán Bento
// -------------------------------------------------------------
function OperationalLogSection() {
  const { notify } = useFeedback();
  const [logs, setLogs] = useState<OperationalLogRow[]>([]);
  const [category, setCategory] = useState("");
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retentionDays, setRetentionDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const filterParams = () => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  };

  const load = async () => {
    setLoading(true);
    const params = filterParams();
    params.set("page", String(page));
    const response = await fetch(`/api/operational-logs?${params}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(readableApiError(body.error, "Không thể tải nhật ký vận hành."), "error");
    } else {
      setLogs(body.logs ?? []);
      setTotal(body.pagination?.total ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [page, category, from, to]);

  const changeRange = (value: string) => {
    setRange(value);
    setPage(1);
    if (value === "custom") return;
    if (value === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (value === "today" ? 0 : value === "7d" ? 6 : 29));
    const format = (date: Date) =>
      date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    setFrom(format(start));
    setTo(format(end));
  };

  // Xuất báo cáo Excel duy nhất
  const exportExcel = async () => {
    if (from && to && from > to) {
      notify("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.", "error");
      return;
    }
    setExporting(true);
    const params = filterParams();
    params.set("format", "xlsx");
    const response = await fetch(`/api/operational-logs/export?${params}`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      notify(readableApiError(body.error, "Không thể xuất báo cáo nhật ký Excel."), "error");
      setExporting(false);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `nhat-ky-van-hanh-${dateStr}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Đã tải xuống báo cáo kiểm toán Excel thành công.", "success");
    setExporting(false);
  };

  useEffect(() => {
    void fetch("/api/operational-logs/settings")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.retentionDays) setRetentionDays(body.retentionDays);
      });
  }, []);

  const saveRetention = async () => {
    const response = await fetch("/api/operational-logs/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retentionDays }),
    });
    const body = await response.json().catch(() => ({}));
    notify(
      response.ok
        ? "Đã cập nhật chính sách lưu trữ nhật ký."
        : readableApiError(body.error, "Không thể cập nhật chính sách lưu trữ."),
      response.ok ? "success" : "error",
    );
  };

  const label: Record<OperationalLogRow["category"], string> = {
    account: "Tài khoản",
    authentication: "Đăng nhập",
    knowledge: "Tri thức",
    configuration: "Cấu hình",
  };

  const badgeClass: Record<OperationalLogRow["category"], string> = {
    account: "bento-badge-cat-account",
    authentication: "bento-badge-cat-authentication",
    knowledge: "bento-badge-cat-knowledge",
    configuration: "bento-badge-cat-configuration",
  };

  const first = total ? (page - 1) * 30 + 1 : 0;
  const last = Math.min(page * 30, total);
  const totalPages = Math.ceil(total / 30) || 1;

  return (
    <div className="bento-log-container">
      {/* 1. Thanh Chính sách lưu trữ (Retention Policy Bar) độc lập */}
      <div className="bento-log-policy-bar">
        <div className="bento-log-policy-info">
          <div className="bento-log-policy-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="12 8 12 12 14 14" />
            </svg>
          </div>
          <div className="bento-log-policy-text">
            <strong>Chính sách lưu trữ nhật ký & Kiểm toán</strong>
            <p>Hệ thống tự động lưu vết toàn bộ hoạt động và tự dọn dẹp các sự kiện cũ hơn thời hạn quy định.</p>
          </div>
        </div>
        <div className="bento-log-policy-actions">
          <div className="bento-log-policy-input-group">
            <span>Thời hạn:</span>
            <input
              type="number"
              min="7"
              max="3650"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              aria-label="Số ngày lưu trữ nhật ký"
            />
            <span>ngày</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void saveRetention()}>
            Lưu chính sách
          </Button>
        </div>
      </div>

      {/* 2. Thẻ Card Bento chính chứa Toolbar và Danh sách */}
      <Card>
        <CardHeader style={{ paddingBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <CardTitle>Nhật ký vận hành & Kiểm toán hệ thống</CardTitle>
              <CardDescription>
                Theo dõi an toàn hoạt động đăng nhập, phân quyền người dùng, cấu hình AI và cập nhật kho tri thức. Không lưu mật khẩu, OTP hay nội dung hội thoại riêng tư.
              </CardDescription>
            </div>
          </div>

          {/* Bento Log Toolbar */}
          <div className="bento-log-toolbar" style={{ marginTop: "1rem" }}>
            <div className="bento-log-filters">
              <div className="bento-log-filter-item">
                <BentoSelect
                  label="Loại hoạt động"
                  value={category}
                  onChange={(val) => {
                    setPage(1);
                    setCategory(val);
                  }}
                  options={[
                    { value: "", label: "Tất cả hoạt động" },
                    { value: "account", label: "Quản trị tài khoản" },
                    { value: "authentication", label: "Đăng nhập & Xác thực" },
                    { value: "knowledge", label: "Kho tri thức" },
                    { value: "configuration", label: "Cấu hình hệ thống" },
                  ]}
                  minWidth="190px"
                />
              </div>

              <div className="bento-log-filter-item">
                <BentoSelect
                  label="Thời gian"
                  value={range}
                  onChange={(val) => changeRange(val)}
                  options={[
                    { value: "all", label: "Toàn bộ thời gian" },
                    { value: "today", label: "Hôm nay" },
                    { value: "7d", label: "7 ngày qua" },
                    { value: "30d", label: "30 ngày qua" },
                    { value: "custom", label: "Tùy chọn ngày" },
                  ]}
                  minWidth="160px"
                />
              </div>

              {range === "custom" && (
                <>
                  <div className="bento-log-filter-item" style={{ width: "140px" }}>
                    <Input
                      label="Từ ngày"
                      type="date"
                      value={from}
                      max={to || undefined}
                      onChange={(e) => {
                        setPage(1);
                        setFrom(e.target.value);
                      }}
                    />
                  </div>
                  <div className="bento-log-filter-item" style={{ width: "140px" }}>
                    <Input
                      label="Đến ngày"
                      type="date"
                      value={to}
                      min={from || undefined}
                      onChange={(e) => {
                        setPage(1);
                        setTo(e.target.value);
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Vế phải: Đếm số lượng & Nút xuất Excel duy nhất */}
            <div className="bento-log-actions-bar">
              <span className="bento-log-count-pill">
                Tổng số: <strong>{total}</strong> sự kiện
              </span>

              <button
                type="button"
                className="bento-export-btn"
                disabled={exporting}
                onClick={() => void exportExcel()}
                title="Xuất bảng tính Excel chi tiết đầy đủ thông tin hành động và đối tượng tác động"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="16" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                {exporting ? "Đang xuất báo cáo…" : "Xuất báo cáo Excel"}
              </button>
            </div>
          </div>
        </CardHeader>

        {/* 3. Danh sách nhật ký vận hành Bento */}
        <CardContent style={{ padding: "0 1.25rem 1.25rem 1.25rem" }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
              Đang tải danh sách nhật ký…
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              title="Không tìm thấy bản ghi nhật ký phù hợp"
              description="Các thao tác vận hành mới sẽ tự động xuất hiện tại đây khi phát sinh trong hệ thống."
            />
          ) : (
            <div className="bento-log-card-list">
              {logs.map((log) => (
                <div key={log.id} className="bento-log-row-card">
                  <details>
                    <summary className="bento-log-summary-row">
                      <div className="bento-log-summary-left">
                        <span className={`bento-badge-cat ${badgeClass[log.category] ?? ""}`}>
                          {label[log.category] ?? log.category}
                        </span>
                        <span className="bento-log-title-text" title={log.summary}>
                          {log.summary}
                        </span>
                      </div>
                      <div className="bento-log-summary-right">
                        <time className="bento-log-timestamp">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {new Date(log.created_at).toLocaleString("vi-VN")}
                        </time>
                        <span className="bento-log-chevron">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </span>
                      </div>
                    </summary>

                    {/* Khối chi tiết Bento Event Detail Box */}
                    {Object.keys(log.details ?? {}).length > 0 && (
                      <div className="bento-log-detail-wrapper">
                        <LogEventDetail details={log.details} category={log.category} />
                      </div>
                    )}
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        {/* 4. Footer phân trang Bento */}
        {total > 0 && (
          <CardFooter style={{ borderTop: "1px solid var(--color-border-subtle)", padding: "0.875rem 1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "0.5rem" }}>
              <span className="bento-log-page-info">
                Hiển thị <strong>{first}–{last}</strong> trong tổng số <strong>{total}</strong> hoạt động
              </span>
              <div className="bento-log-page-nav">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(page - 1)}
                >
                  Trang trước
                </Button>
                <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", padding: "0 6px" }}>
                  Trang {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(page + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

// -------------------------------------------------------------
// Component chính: Màn hình Cài đặt SettingsScreen
// -------------------------------------------------------------
export function SettingsScreen() {
  const { notify } = useFeedback();
  const [settingsTab, setSettingsTab] = useState<
    "retrieval" | "providers" | "agent" | "users" | "logs"
  >("retrieval");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (
      tab === "agent" ||
      tab === "retrieval" ||
      tab === "providers" ||
      tab === "users" ||
      tab === "logs"
    )
      setSettingsTab(tab as typeof settingsTab);
  }, []);

  // Retrieval State
  const [retrieval, setRetrieval] = useState({
    topK: 10,
    maxArticles: 3,
    keywordWeight: 0.4,
    semanticWeight: 0.6,
    diversityWeight: 0.3,
    autoAnswerThreshold: 0.8,
    sensitiveThreshold: 0.9,
    sensitiveTopics: ["Giá & báo giá", "Hợp đồng", "Bảo mật", "SLA"],
    verifiedOnly: true,
    excludeReplaced: true,
    shadowMode: false,
    mergePrefilterThreshold: 0.4,
    mergeSuggestionThreshold: 0.78,
    mergeUniqueCoverageThreshold: 0.25,
    mergeSynonyms: ["record = bản ghi", "txt record = bản ghi txt"],
  });
  const [retrievalSaving, setRetrievalSaving] = useState(false);

  // Agent Persona State
  const [profileName, setProfileName] = useState("Trợ lý phản hồi");
  const [profileRole, setProfileRole] = useState(
    "Chuyên viên tư vấn nội bộ lịch sự và trung thực",
  );
  const [profileTone, setProfileTone] = useState("professional");
  const [profileLength, setProfileLength] = useState("balanced");
  const [profileFallback, setProfileFallback] = useState("supportive");
  const [profileInstructions, setProfileInstructions] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Provider State
  const [savedProviders, setSavedProviders] = useState<
    Array<{
      id: string;
      display_name: string;
      provider_type: string;
      is_enabled: boolean;
      model?: string | null;
      endpoint?: string | null;
      deployment?: string | null;
      api_version?: string | null;
    }>
  >([]);
  const [providerToggling, setProviderToggling] = useState(false);

  // Gemini State
  const [name, setName] = useState("Google Gemini");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<Array<{ id: string; label: string }>>([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [lastChecked, setLastChecked] = useState("");

  // Azure State
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [azureKey, setAzureKey] = useState("");
  const [azureDeployment, setAzureDeployment] = useState("");
  const [azureModel, setAzureModel] = useState("gpt-4o-mini");
  const [azureVersion, setAzureVersion] = useState("2024-06-01");
  const [azureModels, setAzureModels] = useState<Array<{ id: string; label: string }>>([]);
  const [azureChecking, setAzureChecking] = useState(false);
  const [azureVerified, setAzureVerified] = useState(false);
  const [azureDeploymentVerified, setAzureDeploymentVerified] = useState(false);
  const [azureConfigured, setAzureConfigured] = useState(false);
  const [azureSaving, setAzureSaving] = useState(false);

  const reloadProviders = async () => {
    const response = await fetch("/api/providers");
    if (!response.ok) return;
    const body = await response.json();
    const providers = body?.providers ?? [];
    setSavedProviders(providers);
  };

  useEffect(() => {
    let isCurrent = true;
    void fetch("/api/providers")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!isCurrent) return;
        const providers = body?.providers ?? [];
        setSavedProviders(providers);
        const gemini = providers.find((item: { provider_type?: string }) => item.provider_type === "gemini");
        if (gemini) {
          setName(gemini.display_name ?? "Google Gemini");
          setModel(gemini.model ?? "");
          setConfigured(true);
        }
        const azure = providers.find((item: { provider_type?: string }) => item.provider_type === "azure_openai");
        if (azure) {
          setAzureEndpoint(azure.endpoint ?? "");
          setAzureDeployment(azure.deployment ?? "");
          setAzureModel(azure.model ?? "");
          setAzureVersion(azure.api_version ?? "");
          setAzureConfigured(true);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    void fetch("/api/retrieval/settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body?.settings && setRetrieval(body.settings))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch("/api/assistant/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const profile = body?.profile;
        if (!profile) return;
        setProfileName(profile.name);
        setProfileRole(profile.roleDescription);
        setProfileTone(profile.tone);
        setProfileLength(profile.responseLength);
        setProfileFallback(profile.fallbackStyle);
        setProfileInstructions(profile.customInstructions);
      })
      .catch(() => undefined);
  }, []);

  const toggleProvider = async (selectedProvider: {
    id: string;
    display_name: string;
    is_enabled: boolean;
  }) => {
    setProviderToggling(true);
    try {
      const isEnabled = !selectedProvider.is_enabled;
      const response = await fetch("/api/providers", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId: selectedProvider.id, isEnabled }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      await reloadProviders();
      notify(
        isEnabled
          ? `Đã kích hoạt nhà cung cấp ${selectedProvider.display_name}.`
          : `Đã tắt nhà cung cấp ${selectedProvider.display_name}.`,
        "success",
      );
    } catch {
      notify("Không thể thay đổi trạng thái nhà cung cấp AI.", "error");
    } finally {
      setProviderToggling(false);
    }
  };

  const saveRetrieval = async () => {
    setRetrievalSaving(true);
    try {
      const response = await fetch("/api/retrieval/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(retrieval),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) notify("Đã lưu cấu hình tri thức & tìm kiếm.", "success");
      else notify(readableApiError(body.error, "Không thể lưu cấu hình."), "error");
    } finally {
      setRetrievalSaving(false);
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      const response = await fetch("/api/assistant/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          roleDescription: profileRole,
          tone: profileTone,
          responseLength: profileLength,
          fallbackStyle: profileFallback,
          customInstructions: profileInstructions,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) notify("Đã lưu hồ sơ tính cách Trợ lý AI.", "success");
      else notify(readableApiError(body.error, "Không thể lưu tính cách."), "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const verifyGemini = async () => {
    if (!key.trim()) return notify("Vui lòng nhập API key Gemini trước.", "error");
    setChecking(true);
    setVerified(false);
    const response = await fetch("/api/providers/gemini/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    });
    const body = await response.json().catch(() => ({}));
    setChecking(false);
    if (!response.ok) return notify(body.error ?? "Kiểm tra API key thất bại.", "error");
    setModels(body.models ?? []);
    setVerified(true);
    setLastChecked(new Date().toLocaleTimeString("vi-VN"));
    notify("Kết nối Google Gemini thành công. Vui lòng chọn Model.", "success");
  };

  const saveGemini = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: "gemini",
          displayName: name,
          apiKey: key,
          model,
        }),
      });
      if (!response.ok) throw new Error();
      await reloadProviders();
      setConfigured(true);
      setKey("");
      setVerified(false);
      notify("Đã lưu cấu hình Google Gemini an toàn.", "success");
    } catch {
      notify("Không thể lưu cấu hình Google Gemini.", "error");
    } finally {
      setSaving(false);
    }
  };

  const verifyAzure = async () => {
    if (!azureEndpoint.trim() || !azureKey.trim()) {
      return notify("Nhập endpoint và API key Azure trước.", "error");
    }
    setAzureChecking(true);
    try {
      const response = await fetch("/api/providers/azure/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: azureEndpoint,
          apiKey: azureKey,
          deployment: azureDeployment.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      setAzureVersion(body.apiVersion ?? "");
      setAzureModels(body.models ?? []);
      setAzureModel((c) =>
        body.models?.some((x: { id: string }) => x.id === c)
          ? c
          : (body.models?.[0]?.id ?? ""),
      );
      setAzureVerified(true);
      setAzureDeploymentVerified(Boolean(body.deploymentVerified));
      notify("Kết nối Azure OpenAI thành công.", "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Kiểm tra Azure thất bại.", "error");
    } finally {
      setAzureChecking(false);
    }
  };

  const saveAzure = async () => {
    setAzureSaving(true);
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerType: "azure_openai",
          displayName: "Azure OpenAI",
          endpoint: azureEndpoint,
          apiKey: azureKey,
          deployment: azureDeployment,
          model: azureModel,
          apiVersion: azureVersion,
        }),
      });
      if (!response.ok) throw new Error();
      await reloadProviders();
      setAzureConfigured(true);
      setAzureKey("");
      notify("Đã lưu cấu hình Azure OpenAI.", "success");
    } catch {
      notify("Không thể lưu cấu hình Azure OpenAI.", "error");
    } finally {
      setAzureSaving(false);
    }
  };

  const geminiProvider = savedProviders.find((p) => p.provider_type === "gemini");
  const azureProvider = savedProviders.find((p) => p.provider_type === "azure_openai");

  return (
    <AppShell screen="settings">
      <div className="bento-page-header">
        <div>
          <span className="bento-eyebrow">QUẢN TRỊ & THIẾT LẬP HỆ THỐNG</span>
          <h1 className="bento-page-title">Cài Đặt Hệ Thống</h1>
          <p className="bento-page-desc">
            Cấu hình mô hình ngôn ngữ AI, tham số tìm kiếm tri thức, phân quyền và nhật ký kiểm toán.
          </p>
        </div>
      </div>

      {/* Tabs thanh điều hướng */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: "0.5rem" }}>
        {[
          ["retrieval", "Tri thức & Tìm kiếm"],
          ["providers", "Nhà cung cấp AI"],
          ["agent", "Hồ sơ Trợ lý"],
          ["users", "Quản trị người dùng"],
          ["logs", "Nhật ký vận hành"],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant={settingsTab === id ? "primary" : "ghost"}
            size="md"
            onClick={() => setSettingsTab(id as typeof settingsTab)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Tab: Tri thức & Tìm kiếm */}
      {settingsTab === "retrieval" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <Card>
            <CardHeader>
              <CardTitle>1. Lựa chọn nguồn tri thức & Giới hạn</CardTitle>
              <CardDescription>Giới hạn số lượng tài liệu và đoạn tìm kiếm đưa vào prompt phản hồi.</CardDescription>
            </CardHeader>
            <CardContent style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.5rem" }}>
                  Số đoạn tìm kiếm thô (Top-K): {retrieval.topK}
                </label>
                <input
                  type="range"
                  min="3"
                  max="30"
                  value={retrieval.topK}
                  onChange={(e) => setRetrieval({ ...retrieval, topK: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "var(--color-primary)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.5rem" }}>
                  Số bài viết tối đa đưa vào prompt: {retrieval.maxArticles}
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={retrieval.maxArticles}
                  onChange={(e) => setRetrieval({ ...retrieval, maxArticles: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "var(--color-primary)" }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Ngưỡng tự động trả lời & Chủ đề nhạy cảm</CardTitle>
              <CardDescription>Thiết lập độ tương đồng tối thiểu để Trợ lý tự tin phản hồi.</CardDescription>
            </CardHeader>
            <CardContent style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <Input
                label="Ngưỡng tự trả lời (%)"
                type="number"
                min="50"
                max="100"
                value={String(Math.round(retrieval.autoAnswerThreshold * 100))}
                onChange={(e) =>
                  setRetrieval({ ...retrieval, autoAnswerThreshold: Number(e.target.value) / 100 })
                }
                hint="Dưới ngưỡng này sẽ tự động chuyển vào Hàng đợi xử lý."
              />
              <Input
                label="Ngưỡng chủ đề nhạy cảm (%)"
                type="number"
                min="70"
                max="100"
                value={String(Math.round(retrieval.sensitiveThreshold * 100))}
                onChange={(e) =>
                  setRetrieval({ ...retrieval, sensitiveThreshold: Number(e.target.value) / 100 })
                }
                hint="Áp dụng cho các chủ đề giá, hợp đồng, bảo mật."
              />
              <div style={{ gridColumn: "span 2" }}>
                <Input
                  label="Danh sách từ khóa chủ đề nhạy cảm"
                  value={retrieval.sensitiveTopics.join(", ")}
                  onChange={(e) =>
                    setRetrieval({
                      ...retrieval,
                      sensitiveTopics: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                    })
                  }
                  hint="Phân tách bằng dấu phẩy, ví dụ: Giá & báo giá, Hợp đồng, SLA, Bảo mật"
                />
              </div>
            </CardContent>
            <CardFooter style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="primary"
                size="md"
                disabled={retrievalSaving}
                onClick={() => void saveRetrieval()}
              >
                {retrievalSaving ? "Đang lưu cấu hình…" : "Lưu cấu hình tri thức →"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Tab: Nhà cung cấp AI */}
      {settingsTab === "providers" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Card Google Gemini */}
          <Card>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardTitle>Google Gemini</CardTitle>
                <Badge variant={geminiProvider?.is_enabled ? "success" : "neutral"} size="sm">
                  {geminiProvider?.is_enabled ? "Đang kích hoạt" : "Đang tắt"}
                </Badge>
              </div>
              <CardDescription>Mô hình ngôn ngữ đám mây tốc độ cao từ Google.</CardDescription>
            </CardHeader>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Input
                label="Tên hiển thị"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="API Key"
                type="password"
                placeholder={configured ? "Đã lưu an toàn (nhập khóa mới nếu muốn đổi)" : "Nhập API Key Gemini"}
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setVerified(false);
                }}
              />
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={checking || !key.trim()}
                  onClick={() => void verifyGemini()}
                >
                  {checking ? "Đang kiểm tra…" : "Kiểm tra API Key"}
                </Button>
                {verified && (
                  <Badge variant="success" size="sm">
                    ✓ Hợp lệ lúc {lastChecked}
                  </Badge>
                )}
              </div>
              <BentoSelect
                label="Mô hình (Model)"
                value={model}
                disabled={!verified && !model}
                placeholder="Chọn Model Gemini…"
                options={[
                  { value: "", label: "Chọn Model Gemini…" },
                  ...models.map((m) => ({ value: m.id, label: m.label })),
                  ...(!verified && model && !models.some((m) => m.id === model) ? [{ value: model, label: model }] : []),
                ]}
                onChange={(val) => setModel(val)}
              />
            </CardContent>
            <CardFooter style={{ display: "flex", justifyContent: "space-between" }}>
              {geminiProvider && (
                <Button
                  variant={geminiProvider.is_enabled ? "danger" : "secondary"}
                  size="md"
                  disabled={providerToggling}
                  onClick={() => void toggleProvider(geminiProvider)}
                >
                  {geminiProvider.is_enabled ? "Tắt dịch vụ" : "Bật dịch vụ"}
                </Button>
              )}
              <Button
                variant="primary"
                size="md"
                disabled={saving || !model}
                onClick={() => void saveGemini()}
              >
                {saving ? "Đang lưu…" : "Lưu cấu hình"}
              </Button>
            </CardFooter>
          </Card>

          {/* Card Azure OpenAI */}
          <Card>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardTitle>Azure OpenAI</CardTitle>
                <Badge variant={azureProvider?.is_enabled ? "success" : "neutral"} size="sm">
                  {azureProvider?.is_enabled ? "Đang kích hoạt" : "Đang tắt"}
                </Badge>
              </div>
              <CardDescription>Hạ tầng OpenAI doanh nghiệp chạy trên Microsoft Azure.</CardDescription>
            </CardHeader>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Input
                label="Endpoint URL"
                placeholder="https://your-resource.openai.azure.com"
                value={azureEndpoint}
                onChange={(e) => setAzureEndpoint(e.target.value)}
              />
              <Input
                label="API Key"
                type="password"
                placeholder={azureConfigured ? "Đã lưu an toàn (nhập mới để đổi)" : "Nhập Azure API Key"}
                value={azureKey}
                onChange={(e) => setAzureKey(e.target.value)}
              />
              <Input
                label="Deployment Name"
                placeholder="Ví dụ: gpt-4o-deployment"
                value={azureDeployment}
                onChange={(e) => setAzureDeployment(e.target.value)}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={azureChecking || !azureEndpoint.trim() || !azureKey.trim()}
                  onClick={() => void verifyAzure()}
                >
                  {azureChecking ? "Đang kiểm tra…" : "Kiểm tra kết nối"}
                </Button>
              </div>
            </CardContent>
            <CardFooter style={{ display: "flex", justifyContent: "space-between" }}>
              {azureProvider && (
                <Button
                  variant={azureProvider.is_enabled ? "danger" : "secondary"}
                  size="md"
                  disabled={providerToggling}
                  onClick={() => void toggleProvider(azureProvider)}
                >
                  {azureProvider.is_enabled ? "Tắt dịch vụ" : "Bật dịch vụ"}
                </Button>
              )}
              <Button
                variant="primary"
                size="md"
                disabled={azureSaving || !azureDeployment.trim()}
                onClick={() => void saveAzure()}
              >
                {azureSaving ? "Đang lưu…" : "Lưu Azure"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Tab: Hồ sơ Trợ lý */}
      {settingsTab === "agent" && (
        <Card>
          <CardHeader>
            <CardTitle>Hồ sơ & Giọng điệu của Trợ lý AI</CardTitle>
            <CardDescription>
              Tùy biến phong cách giao tiếp của trợ lý mà không làm mất đi nguyên tắc phản hồi có căn cứ.
            </CardDescription>
          </CardHeader>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input
                label="Tên Trợ lý"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <Input
                label="Vai trò / Định vị"
                value={profileRole}
                onChange={(e) => setProfileRole(e.target.value)}
              />
              <BentoSelect
                label="Giọng điệu (Tone)"
                value={profileTone}
                options={[
                  { value: "professional", label: "Chuyên nghiệp, ấm áp" },
                  { value: "friendly", label: "Thân thiện, gần gũi" },
                  { value: "concise", label: "Ngắn gọn, súc tích" },
                ]}
                onChange={(val) => setProfileTone(val)}
              />
              <BentoSelect
                label="Độ dài phản hồi"
                value={profileLength}
                options={[
                  { value: "concise", label: "Ngắn gọn" },
                  { value: "balanced", label: "Cân bằng" },
                  { value: "detailed", label: "Chi tiết" },
                ]}
                onChange={(val) => setProfileLength(val)}
              />
            </div>
            <Textarea
              label="Chỉ dẫn bổ sung (Custom System Instructions)"
              placeholder="Ví dụ: Xưng hô 'em' với khách hàng, ưu tiên trả lời bằng các bước 1-2-3 rõ ràng…"
              value={profileInstructions}
              onChange={(e) => setProfileInstructions(e.target.value)}
              rows={4}
            />
          </CardContent>
          <CardFooter style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="primary"
              size="md"
              disabled={profileSaving}
              onClick={() => void saveProfile()}
            >
              {profileSaving ? "Đang lưu…" : "Lưu hồ sơ Trợ lý →"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Tab: Quản trị người dùng */}
      {settingsTab === "users" && <UserManagementSection />}

      {/* Tab: Nhật ký vận hành */}
      {settingsTab === "logs" && <OperationalLogSection />}
    </AppShell>
  );
}
