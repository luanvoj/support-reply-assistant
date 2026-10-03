# Trạng thái hiện hành

## Snapshot

- **Plan mới**: [chuẩn hóa UI Nhật ký vận hành & nâng cấp báo cáo xuất Excel](plans/2026-09-29-operational-logs-bento-ux-and-export.md) — Tách Bento Retention Panel, tinh gọn toolbar bộ lọc, gộp thành 1 nút xuất Excel, chuyển đổi chi tiết sự kiện từ raw JSON sang Bento Metadata Card và bổ sung rõ tên đối tượng tác động (tên bài viết bị xóa) trong file Excel.
- **Kế hoạch tổng hợp toàn hệ thống**: Đã gộp toàn bộ 28 kế hoạch kiến trúc và chuẩn hóa chức năng thành [Tổng hợp kế hoạch kiến trúc & phát triển hệ thống](plans/CONSOLIDATED-PLANS.md) theo 5 trụ cột:
  1. *Xác thực, Danh tính & Vòng đời Tài khoản* (Auth, Identity & Successor Lifecycle).
  2. *Tích hợp AI Provider & Chế độ Suy thoái* (AI Resilience & Degraded Mode).
  3. *Kho Tri thức & Gộp bài viết Thông minh* (Knowledge Base & Smart Merge Workspace).
  4. *Hàng đợi Chuyên gia & Thẩm định Tri thức* (Expert Request Queue & Review).
  5. *Trải nghiệm Người dùng, Bento Design System & Nhật ký Vận hành* (Modern Bento Layout & Operational Logs).
- Toàn bộ các kế hoạch đơn lẻ trước đây đã được lưu trữ an toàn tại `archive/plans/` theo đúng quy định bộ nhớ.
- **Trạng thái UI/UX hiện hành**:
  - Giao diện **Modern Bento Layout** tích hợp nền **Ambient Aurora Mesh Gradient** đa tầng và thanh điều hướng **Frosted Glass** (`.bento-sidebar`, `.bento-topbar`).
  - Hệ thống **Bento Icon Badge Tiles** (`.bento-nav-icon-badge`) sắc nét phân loại màu theo từng vai trò nghiệp vụ.
  - Không gian **Smart Merge Workspace** chuẩn Bento: Header phân tầng, KPI Grid trực quan, preset ngưỡng tương đồng (65/75/85%) và Modal đối chiếu 2 cột (Diff Modal).
  - Chuẩn hóa toàn bộ nhãn **Eyebrow & Subtitle** theo vai trò nghiệp vụ trên 9 màn hình, loại bỏ lặp breadcrumb.
- **Backend & API**:
  - Cập nhật xác thực trạng thái cho endpoint `POST /api/knowledge/merge/batches/:id/items/:itemId/attach` trả về `409 Conflict` nếu nhóm gộp đã được xử lý.
  - Bản dựng Next.js 16 (`npm run build`) đã kiểm tra thành công (exit code 0).

## Module

| Module | Trạng thái | Đọc tiếp |
|---|---|---|
| Trợ lý & RAG | Hoạt động; grounded/partial/escalate, citation, yêu cầu chuyên gia và thứ tự hội thoại ổn định | [assistant](modules/assistant.md) |
| Kho tri thức & gộp bài | Hoạt động, import/CRUD/archive/merge batch | [knowledge](modules/knowledge.md) |
| Cài đặt & AI provider | Hoạt động, Gemini/Azure và retrieval settings | [settings](modules/settings.md) |
| App shell | Dùng chung sidebar/header/RBAC/menu tài khoản cho toàn bộ route protected | [app-shell](modules/app-shell.md) |

## Việc mở có hiệu lực

- Plan: [Thay thế kho tri thức trên deploy bằng dữ liệu mô phỏng đã làm sạch](plans/2026-10-03-deploy-knowledge-library-replacement.md) — deploy đã được làm sạch và import lại; chờ checkpoint Git và luân chuyển credential deploy.

- Plan mới: [Khắc phục findings Security Report 30-09-2026](plans/2026-09-30-security-report-remediation.md) — đóng SEC-007/008 (rate limit OTP và single-active OTP), bổ sung retention reset và hardening DNS rebinding SMTP; chờ phê duyệt triển khai.

- Plan mới: [SMTP và OTP email cho quên mật khẩu](plans/2026-09-30-smtp-otp-password-recovery.md) — cấu hình SMTP Admin-only, OTP email 6 số và reset password public có rate-limit/challenge/session revocation; chờ chốt policy email/domain và SMTP nội bộ trước khi triển khai.

- Plan mới: [Khắc phục SEC-005 rate limit IP `unknown`](plans/2026-09-29-rate-limit-sec-005-remediation.md) — bỏ bucket IP dùng chung khi không có proxy đáng tin cậy, vẫn giữ limit global/identity/challenge và hợp đồng edge proxy.

- Plan mới: [Loại bỏ CTA gộp từng bài, giữ an toàn Smart Merge theo đợt](plans/2026-09-29-remove-single-article-merge-cta.md) — chỉ gỡ entry point UI đơn lẻ trên route active; giữ nguyên API tạo nháp và toàn bộ lifecycle batch.

- Plan mới: [Lọc ngày, xuất Nhật ký vận hành và xác thực email tạo người dùng](plans/2026-09-29-operational-log-export-and-user-email-validation.md) — khôi phục UI khoảng ngày tùy chọn, xuất Excel/CSV đúng filter và hoàn thiện validation email.

1. Chốt provider/model embedding và nghiệm thu semantic vector retrieval.
2. Quyết định target production, secrets, TLS, backup, monitoring và release authorization.
3. Xử lý/accept dependency advisory PostCSS/Next; chủ sở hữu rotate/revoke credential Stitch legacy.
4. Cân nhắc UI cho `verified-only`, kích thước nhóm gộp và retry batch rõ ràng hơn.

- Plan mới: [hardening xác thực và import tri thức](plans/2026-09-28-auth-throttling-and-import-hardening.md) — khép rate limit login/MFA và thay parser `xlsx` có advisory; Admin MFA vẫn optional trong MVP.

## Evidence legacy

- [Nhật ký phát triển cũ](../archive/2026-09/legacy-development-log.md) có lịch sử nghiệm thu và checklist stale; không dùng làm nguồn tiến độ mới.
- [Deployment](../DEPLOYMENT.md), [Security](../SECURITY-REPORT-2026-09-22.md), [API](../API.md) là tài liệu vận hành active.
