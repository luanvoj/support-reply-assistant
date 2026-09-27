# Trạng thái hiện hành

## Snapshot

- Cập nhật: 2026-09-27.
- Ứng dụng local đã build/restart/health-check thành công; Supabase PostgreSQL hoạt động.
- Luồng Trợ lý đã đồng bộ: tên Agent lấy từ profile đang hoạt động, lịch sử dùng thứ tự message ổn định, và yêu cầu chuyên gia gắn duy nhất với phản hồi.
- Plan active: [audit và chuẩn hóa design system toàn ứng dụng](plans/application-design-system-audit.md) — baseline đã triển khai, chờ nghiệm thu UI thủ công.
- Plan đang triển khai: [quản trị người dùng, hồ sơ cá nhân và 2FA](plans/2026-09-27-user-management-identity-and-2fa.md) — lifecycle, RBAC và avatar local đã có; recovery code/Admin reset 2FA còn mở, avatar chờ nghiệm thu browser.
- Plan đã triển khai: [đổi mật khẩu realtime và 2FA](plans/2026-09-27-profile-password-and-mfa-ux.md) — policy 8 ký tự/hoa/thường/ký tự đặc biệt, checklist realtime, TOTP setup/tắt và MFA login challenge đã hoàn tất; chờ nghiệm thu thủ công.
- Case study: [chuẩn hóa UX/UI Kho kiến thức](../UX-UI-CASE-STUDY-KNOWLEDGE.md).
- Plan trước: [chuẩn hóa bố cục và tác vụ Kho kiến thức](plans/knowledge-workspace-layout-and-actions.md) — đã triển khai, chờ nghiệm thu UI thủ công.
- Plan liên quan: [làm rõ flow gộp và nhớ quyết định theo cặp](plans/merge-flow-guidance-and-pair-decisions.md) — phần chính đã triển khai, còn nghiệm thu UI/backend nêu trong plan.
- Plan trước: [làm rõ lỗi tạo bản nháp gộp](plans/merge-draft-error-ux.md) đã triển khai; còn nghiệm thu các nhánh Agent runtime bằng batch thực tế.
- Nguyên tắc làm việc: chỉ phản hồi kết luận đã kiểm chứng; nếu chưa xác minh, phải nói rõ thay vì đoán.

- Plan đã triển khai: [chuẩn hóa layout bốn tab Cài đặt](plans/2026-09-27-settings-layout-system.md) — content container chung đã áp dụng; chờ nghiệm thu UI thủ công.
- Plan đã triển khai: [menu tài khoản tại sidebar](plans/2026-09-27-sidebar-account-menu.md) — gộp CTA tài khoản thành menu Thông tin người dùng/Đăng xuất, giữ nguyên auth contract; chờ nghiệm thu UI thủ công.
- Quyết định hoãn: [tìm kiếm và thông báo ở header](plans/2026-09-27-deferred-header-actions.md) — đã ẩn vì chưa có hành vi thực; chỉ khôi phục khi có contract, RBAC và UI flow được chốt.
- Plan đã triển khai: [hợp nhất shell Tổng quan với các màn vận hành](plans/2026-09-27-unify-dashboard-app-shell.md) — Dashboard và mọi màn vận hành dùng AppShell chung; chờ nghiệm thu theo role/viewport.

## Module

| Module | Trạng thái | Đọc tiếp |
|---|---|---|
| Trợ lý & RAG | Hoạt động; grounded/partial/escalate, citation, yêu cầu chuyên gia và thứ tự hội thoại ổn định | [assistant](modules/assistant.md) |
| Kho tri thức & gộp bài | Hoạt động, import/CRUD/archive/merge batch | [knowledge](modules/knowledge.md) |
| Cài đặt & AI provider | Hoạt động, Gemini/Azure và retrieval settings | [settings](modules/settings.md) |
| App shell | Dùng chung sidebar/header/RBAC/menu tài khoản cho toàn bộ route protected | [app-shell](modules/app-shell.md) |

## Việc mở có hiệu lực

1. Chốt provider/model embedding và nghiệm thu semantic vector retrieval.
2. Quyết định target production, secrets, TLS, backup, monitoring và release authorization.
3. Xử lý/accept dependency advisory PostCSS/Next; chủ sở hữu rotate/revoke credential Stitch legacy.
4. Cân nhắc UI cho `verified-only`, kích thước nhóm gộp và retry batch rõ ràng hơn.

## Evidence legacy

- [Nhật ký phát triển cũ](../archive/2026-09/legacy-development-log.md) có lịch sử nghiệm thu và checklist stale; không dùng làm nguồn tiến độ mới.
- [Deployment](../DEPLOYMENT.md), [Security](../SECURITY-REPORT-2026-09-22.md), [API](../API.md) là tài liệu vận hành active.
