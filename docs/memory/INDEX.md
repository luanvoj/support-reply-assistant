# Trạng thái hiện hành

## Snapshot

- Plan mới: [bố cục xử lý Yêu cầu chuyên gia theo Kho kiến thức](plans/2026-09-28-expert-request-top-editor-layout.md) — editor một cột mở trên danh sách khi chọn ticket, giữ deep link/API/RBAC hiện có và bỏ panel xử lý bên phải.

- Plan đang triển khai: [xóa vĩnh viễn yêu cầu chuyên gia mới](plans/2026-09-28-delete-new-expert-requests.md) — Chuyên gia/Admin chỉ xóa ticket `new` chưa review; đồng bộ classification hội thoại và không giữ log chứa nội dung ticket.

- Plan đã triển khai: [landing page Hướng dẫn sử dụng](plans/2026-09-27-user-guide-landing-page.md) — thêm hướng dẫn theo vai trò, sơ đồ Agent/điểm căn cứ/gộp bài và diễn giải Cài đặt theo tác động thực tế; chờ nghiệm thu browser/RBAC.

- Plan đã triển khai: [chuẩn hóa workspace Yêu cầu chuyên gia](plans/2026-09-27-expert-request-master-detail-pagination.md) — tách danh sách/chi tiết thành master–detail độc lập, thêm phân trang và tìm kiếm server-side; chờ nghiệm thu browser/RBAC.

- Plan mới: [chuẩn hóa resilience cho mọi luồng phụ thuộc Agent](plans/2026-09-27-provider-resilience-coverage.md) — đưa re-rank và gộp tri thức về circuit/retry contract chung; chưa triển khai.

- Plan mới: [chế độ tra cứu tri thức khi Agent không sẵn sàng](plans/2026-09-27-provider-degraded-knowledge-mode.md) — tách quyết định tri thức khỏi lỗi Agent, trả gợi ý từ nguồn đã xác minh khi an toàn và dùng retry/circuit breaker có trạng thái; chưa triển khai.

- Cập nhật: 2026-09-27.
- Ứng dụng local đã build/restart/health-check thành công; Supabase PostgreSQL hoạt động.
- Luồng Trợ lý đã đồng bộ: tên Agent lấy từ profile đang hoạt động, lịch sử dùng thứ tự message ổn định, và yêu cầu chuyên gia gắn duy nhất với phản hồi.
- Plan active: [audit và chuẩn hóa design system toàn ứng dụng](plans/application-design-system-audit.md) — baseline đã triển khai, chờ nghiệm thu UI thủ công.
- Plan đang triển khai: [hợp nhất luồng Yêu cầu chuyên gia](plans/2026-09-27-expert-request-workflow.md) — Agent hai nhánh và workspace một route đã áp dụng; còn nghiệm thu role/browser, assignment và phản hồi riêng.
- Plan mới: [gộp yêu cầu chuyên gia trùng lặp](plans/2026-09-27-expert-request-deduplication.md) — thiết kế group/occurrence để nhiều người báo cùng vấn đề không tạo phiếu trùng; chưa triển khai.
- Plan đang nghiệm thu: [rà hồi quy hành vi toàn bộ Cài đặt](plans/2026-09-27-settings-behavior-regression-audit.md) — contract Agent/Tri thức đã chuẩn hóa; còn browser/provider/RBAC end-to-end.
- Plan đã triển khai: [tách cấu hình và bật/tắt Agent theo từng nhà cung cấp](plans/2026-09-27-provider-configuration-and-activation-ux.md) — Gemini/Azure được lưu độc lập, card tự bật/tắt và database bảo đảm chỉ 0 hoặc 1 Agent hoạt động; chờ nghiệm thu browser theo trạng thái/viewport.
- Plan mới: [kết nối Vibe Host MCP và triển khai ứng dụng](plans/2026-09-27-vibehost-mcp-and-deployment.md) — chờ rotate token, xác minh schema MCP và chốt exposure trước khi cấu hình/deploy.
- Plan đã triển khai: [chuẩn hóa màn hình đăng nhập](plans/2026-09-27-login-auth-surface.md) — ẩn SSO/Okta chưa có contract, đồng bộ input và nâng minh họa luồng phản hồi; chờ nghiệm thu browser/viewport.
- Plan đang triển khai: [quản trị người dùng, hồ sơ cá nhân và 2FA](plans/2026-09-27-user-management-identity-and-2fa.md) — lifecycle, RBAC, avatar local và Admin recovery đã có; avatar chờ nghiệm thu browser.
- Plan đã triển khai: [Quản trị viên khôi phục bảo mật tài khoản người dùng](plans/2026-09-27-admin-user-security-recovery.md) — reset mật khẩu/tắt 2FA có audit, thu hồi phiên và modal Điều chỉnh đã được chuẩn hóa; chờ nghiệm thu browser theo trạng thái/viewport.
- Plan đang triển khai: [tách vô hiệu hóa, khôi phục và xóa tài khoản có người kế thừa](plans/2026-09-28-user-disable-delete-successor-lifecycle.md) — thay lifecycle cũ để khóa đăng nhập có thể đảo ngược, xóa yêu cầu kế thừa theo hierarchy và không còn retention mơ hồ.
- Plan mới: [xóa hẳn tài khoản và nhật ký vận hành có thời hạn](plans/2026-09-28-hard-delete-and-operational-log.md) — hard-delete cần migration FK/audit riêng; thêm Log cấu hình/tri thức/login không bao gồm chat, retention configurable; chờ chốt policy chat và triển khai.
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

- Plan mới: [lọc thời gian và phân trang Nhật ký vận hành](plans/2026-09-28-operational-log-time-filter-pagination.md) — filter server-side theo khoảng thời gian/category, footer phân trang rõ ràng và không ảnh hưởng retention.

1. Chốt provider/model embedding và nghiệm thu semantic vector retrieval.
2. Quyết định target production, secrets, TLS, backup, monitoring và release authorization.
3. Xử lý/accept dependency advisory PostCSS/Next; chủ sở hữu rotate/revoke credential Stitch legacy.
4. Cân nhắc UI cho `verified-only`, kích thước nhóm gộp và retry batch rõ ràng hơn.

- Plan mới: [hardening xác thực và import tri thức](plans/2026-09-28-auth-throttling-and-import-hardening.md) — khép rate limit login/MFA và thay parser `xlsx` có advisory; Admin MFA vẫn optional trong MVP.

## Evidence legacy

- [Nhật ký phát triển cũ](../archive/2026-09/legacy-development-log.md) có lịch sử nghiệm thu và checklist stale; không dùng làm nguồn tiến độ mới.
- [Deployment](../DEPLOYMENT.md), [Security](../SECURITY-REPORT-2026-09-22.md), [API](../API.md) là tài liệu vận hành active.
