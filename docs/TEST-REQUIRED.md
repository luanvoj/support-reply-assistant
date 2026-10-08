# TEST-REQUIRED — Competition readiness

> Definition of Done cho phạm vi này: mỗi TC dưới đây có bằng chứng chạy thật; provider live và scheduler production không thuộc lượt kiểm thử local.

## Bảng tracking

| TC | Mô tả ngắn | Cách chạy | Trạng thái | Chứng cứ | Lần chạy cuối |
|---|---|---|---|---|---|
| TC-COMP-01 | Login sales và dashboard desktop | `tests/e2e/competition-readiness.spec.ts` | ✅ pass | `playwright-report/index.html` | 2026-10-08 |
| TC-COMP-02 | Dashboard 375px không tràn ngang | Playwright screenshot | ✅ pass | `playwright-report/index.html`, `test-results/tc-comp-02-mobile-dashboard.png` | 2026-10-08 |
| TC-COMP-03 | Trợ lý 375px giữ composer | Playwright screenshot | ✅ pass | `playwright-report/index.html`, `test-results/tc-comp-03-mobile-assistant.png` | 2026-10-08 |
| TC-COMP-04 | Sales bị chặn API admin bằng 403 | Playwright browser fetch | ✅ pass | `playwright-report/index.html` | 2026-10-08 |
| TC-COMP-05 | Route protected chuyển về login | Playwright | ✅ pass | `playwright-report/index.html` | 2026-10-08 |

## Tiêu chí

### TC-COMP-01 — Login desktop

- Tiền đề: đã chạy migration và seed local với `SEED_PASSWORD`.
- ĐẠT khi: `sales@example.local` đăng nhập được và dashboard không có scroll ngang tại 1440px.
- Căn cứ: `app/login/page.tsx`, `middleware.ts`, `components/dashboard.tsx`.

### TC-COMP-02 — Dashboard mobile

- ĐẠT khi: ở 375×812, dashboard không có scroll ngang và navigation dùng target cao tối thiểu 48px.
- Căn cứ: `app/globals.css` mobile breakpoint.

### TC-COMP-03 — Trợ lý mobile

- ĐẠT khi: ở 375×812, route `/assistant` tải được, composer nhìn thấy được và không tràn ngang.
- Căn cứ: `components/screens/assistant-screen.tsx`, `app/chat-styles.css`, `app/globals.css`.

### TC-COMP-04 — RBAC API

- ĐẠT khi: session `sales` gọi `GET /api/retrieval/settings` nhận chính xác `403` và code `FORBIDDEN`, không phải `500`.
- Căn cứ: `lib/auth/guard.ts`, `app/api/retrieval/settings/route.ts`.

### TC-COMP-05 — Route protected

- ĐẠT khi: người chưa đăng nhập mở `/assistant` được chuyển đến `/login` và thấy form đăng nhập.
- Căn cứ: `middleware.ts`, `app/login/page.tsx`.

## Giới hạn

- Provider live, Smart Merge worker có Agent thật và scheduler production là BLOCKED chờ provider/hạ tầng.
- Test này không thay thế kiểm thử tay về nội dung, màu sắc và cảm nhận thị giác.
