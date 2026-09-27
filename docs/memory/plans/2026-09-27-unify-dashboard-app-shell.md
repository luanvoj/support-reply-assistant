# Hợp nhất shell Tổng quan với các màn vận hành

## Mục tiêu

Đưa Tổng quan (`/`) vào cùng một application shell với Trợ lý, Hội thoại, Kho kiến thức, Hàng đợi, Hồ sơ và Cài đặt. Mọi thay đổi về sidebar, header, menu tài khoản, RBAC, responsive và design token sau này phải đi qua một nguồn component duy nhất thay vì sao chép markup theo từng màn.

## Chẩn đoán đã xác minh

Đây là lỗi kiến trúc/layout, không phải lỗi dữ liệu hay API.

- `app/page.tsx` render trực tiếp `components/dashboard.tsx`.
- Sáu route còn lại (`/assistant`, `/conversations`, `/knowledge-base`, `/unanswered`, `/profile`, `/settings`) đều render `OperationsScreen` trong `components/operations.tsx`.
- `components/dashboard.tsx` tự dựng sidebar, header, lấy profile/role và logout riêng; nó vẫn có thẻ tài khoản link trực tiếp cùng nút logout rời.
- `components/operations.tsx` có `Shell` riêng, nơi menu tài khoản mới, logout, header không còn search/notification và navigation RBAC đã được cập nhật.
- Hai cây dùng class/layout khác nhau: Dashboard là `.app-shell`/`.main-content`/`.topbar`; các màn vận hành là `.ops-shell`/`.ops-main`/`.ops-topbar`. `app/globals.css` còn nhiều rule song song cho hai nhóm này.
- Ô search Dashboard hiện chỉ lọc mảng hàng đợi đã tải; nhãn của nó mô tả tìm kiếm toàn hệ thống. Nút notification chỉ ghi notice tĩnh. Đây là lý do chúng vẫn xuất hiện ở Tổng quan dù đã được ẩn khỏi shell vận hành.

## Quyết định kiến trúc

Tạo một **AppShell duy nhất cho mọi route đã đăng nhập**. Shell sở hữu duy nhất các trách nhiệm chung: sidebar, navigation RBAC, header/breadcrumb, profile fetch, menu tài khoản, logout, feedback/toast và responsive sidebar.

Nội dung từng màn chỉ sở hữu dữ liệu và tác vụ của chính màn đó. Dashboard vẫn giữ KPI, export báo cáo, lọc hàng đợi và thông báo lỗi tải dữ liệu, nhưng không được dựng lại navigation/header/account actions.

## Kế hoạch triển khai

1. **Lập contract AppShell.** Tách `Screen`, nhãn route, navigation RBAC, `AppFeedbackProvider`, toast/confirm và `Shell` từ `components/operations.tsx` thành component chia sẻ, ví dụ `components/app-shell.tsx`. Contract nhận `screen` và `children`; không truyền state nghiệp vụ Dashboard vào shell.
2. **Chuyển sáu màn vận hành sang shell chung.** `OperationsScreen` dùng AppShell mới mà không đổi endpoint, payload, quyền, hay flow Assistant/Profile/Settings. Đây là bước regression guard trước khi chuyển Dashboard.
3. **Chuyển Dashboard vào AppShell.** Xóa sidebar/header/profile/logout trùng lặp trong `components/dashboard.tsx`; bọc nội dung Dashboard bằng AppShell với screen `overview`. Di chuyển ô lọc queue ra gần bảng hàng đợi và đặt nhãn đúng phạm vi, hoặc chỉ giữ filter chip hiện có. Không khôi phục search/notification header vì đang ở trạng thái hoãn đã ghi memory.
4. **Hợp nhất lớp layout/CSS.** Chuyển các selector Dashboard còn cần thiết sang primitive chung (`.ops-main`, `.ops-page-head`, panel, CTA, table, sidebar) rồi loại bỏ hoặc cô lập các selector legacy `.app-shell`, `.main-content`, `.topbar`, `.top-actions`, `.search` chỉ còn phục vụ Dashboard cũ. Không sửa UI theo kiểu thêm override cuối file; mỗi selector cũ chỉ được xóa sau khi có thay thế tương đương.
5. **Ngăn tái diễn.** Ghi quy ước trong module design-system: route đã đăng nhập bắt buộc dùng AppShell; screen mới chỉ được thêm content component/route mapping, không tự tạo sidebar/header/account/logout. Thêm kiểm tra source mức nhẹ (test hoặc lint/structural assertion phù hợp toolchain) để phát hiện route protected render shell legacy hay tự gọi profile/logout.
6. **Xác minh theo một matrix chung.** Typecheck/build; smoke route `/`, `/assistant`, `/conversations`, `/knowledge-base`, `/unanswered`, `/profile`, `/settings`. Nghiệm thu manual desktop/tablet/mobile: active nav, RBAC của ba role, menu tài khoản, logout, breadcrumb/header, queue filter Dashboard, export báo cáo và empty/error state. So sánh screenshot Tổng quan–Trợ lý để bảo đảm cùng sidebar/header/account menu.

## File dự kiến

- Thêm `components/app-shell.tsx` (tên cuối cùng theo cấu trúc thực tế khi triển khai).
- `components/operations.tsx`.
- `components/dashboard.tsx`.
- `app/page.tsx` nếu cần chuyển ownership provider/route mapping.
- `app/globals.css`.
- `docs/memory/modules/` liên quan design system hoặc module mới, sau khi contract đã được triển khai.

## Rủi ro cần kiểm soát

- Không chuyển Dashboard nguyên khối sang `OperationsScreen`: nó có data fetch, export và queue filter riêng; chỉ dùng chung shell, không trộn nghiệp vụ vào component trợ lý.
- Không bỏ queue filtering khi ẩn global search: đây là hành vi Dashboard có thật, chỉ cần đặt đúng ngữ cảnh và copy.
- `AppFeedbackProvider` hiện nằm trong `operations.tsx`; tách sai có thể làm confirm/toast ở profile/settings hỏng. Cần chuyển provider và retest cả Dashboard lẫn Operations.
- Browser visual/e2e chưa có bằng chứng trong lượt lập kế hoạch. Các kết luận về desktop/mobile sau refactor phải được ghi PASS hoặc NOT-RUN riêng.

## Tiêu chí hoàn tất

- [x] Mọi route đã đăng nhập sử dụng cùng một AppShell; không còn Dashboard sidebar/header/account/logout riêng.
- [x] Menu tài khoản và logout có cùng implementation trên `/` và toàn bộ màn vận hành.
- [x] Header không tái xuất hiện search/notification chưa triển khai; queue filter còn hoạt động ở đúng khu vực Dashboard.
- [ ] Navigation và route guard hiển thị đúng cho `sales`, `technical`, `admin` ở cả Tổng quan và các màn khác — chưa có session test theo từng role.
- [x] Dashboard không còn phụ thuộc `.app-shell`, `.main-content`, `.topbar`, `.top-actions` hay `.search`; content wrapper chỉ sở hữu mật độ/layout Dashboard.
- [x] `npm run typecheck` PASS; dev restart và smoke unauthenticated routes PASS (`/login` 200, các route protected 307 về `/login`).
- [ ] Nghiệm thu authenticated flow, responsive/visual và build completion cần ghi riêng.

## Kết quả triển khai

- PASS — Thêm `components/app-shell.tsx` là nguồn duy nhất của sidebar, navigation RBAC, header, profile fetch, menu tài khoản, logout và feedback overlay.
- PASS — `components/dashboard.tsx` dùng `AppShell` với screen `overview`; xóa sidebar/header/logout/profile fetch trùng lặp.
- PASS — `components/operations.tsx` dùng cùng AppShell cho toàn bộ screen vận hành.
- PASS — Filter Dashboard vẫn hoạt động nhưng được đặt tại panel Hàng đợi thay vì header toàn hệ thống.
- PASS — `npm run typecheck`.
- PASS — Sau `app.sh restart`, `/login` trả 200; `/`, `/assistant`, `/conversations`, `/knowledge-base`, `/unanswered`, `/profile`, `/settings` trả 307 tới login khi không có session.
- NOT-RUN — Browser session theo ba role, menu tài khoản/logout thực tế, responsive 1440/1024/768/375 và build completion sau refactor.
