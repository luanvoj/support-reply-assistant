# App shell

## Contract

- Mọi route đã đăng nhập dùng `AppShell` từ `components/app-shell.tsx`.
- AppShell là nguồn duy nhất cho sidebar, navigation theo role, header/breadcrumb, fetch profile, menu Thông tin người dùng/Đăng xuất, logout và feedback overlay.
- `/guide` là route protected dùng AppShell; mục **Hướng dẫn sử dụng** đứng ngay sau Tổng quan và có mặt ở cả `sales`, `technical`, `admin`. Nội dung có thể lọc theo vai trò, nhưng quyền thật của CTA vẫn do route/server đích quyết định.
- Content của screen không tự dựng sidebar/header/account/logout hoặc gọi `/api/profile` chỉ để hiển thị chrome chung.
- Dashboard chỉ sở hữu KPI, export báo cáo và filter Hàng đợi; không được dùng header để mô phỏng global search hay notification khi chưa có contract tương ứng.

## Quy ước mở rộng

- Route protected mới: thêm một `Screen`/label/navigation mapping nếu cần, rồi bọc nội dung bằng AppShell.
- Mọi thay đổi chrome phải thực hiện ở `components/app-shell.tsx` và kiểm tra tối thiểu Tổng quan + một màn vận hành; không copy markup/CSS qua screen.
- Search toàn hệ thống và notification vẫn ở trạng thái hoãn theo `plans/2026-09-27-deferred-header-actions.md`.

## Giới hạn hiện tại

- RBAC visual/authenticated và responsive AppShell chưa có bằng chứng browser theo từng role/viewport sau refactor.
