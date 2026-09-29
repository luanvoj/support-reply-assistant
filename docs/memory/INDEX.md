# Trạng thái hiện hành

## Snapshot

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

- Plan mới: [lọc thời gian và phân trang Nhật ký vận hành](plans/2026-09-28-operational-log-time-filter-pagination.md) — filter server-side theo khoảng thời gian/category, footer phân trang rõ ràng và không ảnh hưởng retention.

1. Chốt provider/model embedding và nghiệm thu semantic vector retrieval.
2. Quyết định target production, secrets, TLS, backup, monitoring và release authorization.
3. Xử lý/accept dependency advisory PostCSS/Next; chủ sở hữu rotate/revoke credential Stitch legacy.
4. Cân nhắc UI cho `verified-only`, kích thước nhóm gộp và retry batch rõ ràng hơn.

- Plan mới: [hardening xác thực và import tri thức](plans/2026-09-28-auth-throttling-and-import-hardening.md) — khép rate limit login/MFA và thay parser `xlsx` có advisory; Admin MFA vẫn optional trong MVP.

## Evidence legacy

- [Nhật ký phát triển cũ](../archive/2026-09/legacy-development-log.md) có lịch sử nghiệm thu và checklist stale; không dùng làm nguồn tiến độ mới.
- [Deployment](../DEPLOYMENT.md), [Security](../SECURITY-REPORT-2026-09-22.md), [API](../API.md) là tài liệu vận hành active.
