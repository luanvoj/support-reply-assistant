# Plan: Chuẩn hóa layout bốn tab Cài đặt

## Mục tiêu

Tất cả nội dung trong **Cài đặt hệ thống** dùng cùng một content container, cùng biên trái/phải, chiều rộng tối đa, khoảng cách từ tab bar và nhịp panel. Khác biệt về mật độ chỉ phản ánh chức năng, không làm thay đổi khung trang.

## Hiện trạng đã xác minh

- Tab bar `.settings-tabs` đang có `max-width: 1180px` tại `app/globals.css`.
- Tab Agent dùng `.assistant-profile-card` với `max-width: 1180px`.
- Tab Tri thức dùng `.settings-workspace` với `max-width: 1180px` và sidebar nội bộ 260px.
- Tab Nhà cung cấp dùng grid riêng (`.provider-cards-grid` / provider cards), chưa thuộc một container Cài đặt chung.
- Tab Quản trị người dùng dùng `.settings-user-management`; selector hiện hữu không đặt max-width, còn list có `max-width: none`, nên có thể giãn theo shell thay vì theo tab bar.

Nguồn: `components/operations.tsx`, `app/globals.css`, và bốn ảnh nghiệm thu do người dùng cung cấp ngày 2026-09-27.

## Thiết kế đích

| Lớp | Quy ước |
|---|---|
| Settings shell | Một `.settings-content` chung: `width: min(1180px, calc(100% - padding responsive))`, căn giữa, đặt ngay sau tab bar. |
| Tab content | Mỗi tab là child của container chung; không tự đặt `max-width`, margin ngang hoặc `max-width:none` để phá vỡ contract. |
| Panel | `width: 100%`; panel/card con chỉ quyết định số cột nội bộ. Form Agent là panel toàn chiều rộng; provider là grid hai cột trong container; User management là bảng toàn chiều rộng trong container. |
| Khoảng cách | Tab bar → content: 20px; giữa panel chính: 16px; các group trong panel: token spacing đang dùng. |
| Responsive | Cùng gutter với tab bar tại desktop/tablet/mobile. Retrieval sidebar chuyển thành một cột; provider grid chuyển một cột; bảng User vẫn scroll ngang trong container khi cần. |

## Các bước triển khai

1. **Thiết lập container contract, không vá theo tab.**
   - Trong `SettingsScreen`, bọc các nhánh `agent`, `retrieval`, `providers`, `users` bằng một `settings-content` chung ngay sau `.settings-tabs`.
   - Chỉ container này chịu trách nhiệm chiều rộng/căn giữa/gutter; không thay đổi endpoint, state, payload hay RBAC.

2. **Loại bỏ các luật chiều rộng cạnh tranh.**
   - Trong `app/globals.css`, chuyển `.assistant-profile-card`, `.settings-workspace`, `.provider-cards-grid`, `.settings-user-management` sang `width:100%` trong `settings-content`.
   - Bỏ các `max-width`/margin ngang riêng gây lệch; giữ sidebar retrieval và số cột provider như layout nội bộ, không như page container.
   - Rà cascade CSS lịch sử để không còn rule cũ ghi đè width sau layer Cài đặt.

3. **Chuẩn hóa hierarchy panel và CTA theo từng tab.**
   - Agent: một panel form toàn chiều rộng, CTA lưu trong action row.
   - Tri thức: header + sidebar + panels nằm trong cùng chiều rộng; sticky save row bám theo vùng nội dung, không vượt container.
   - Nhà cung cấp: hai provider cards cùng grid/gap, các card bằng chiều rộng cột.
   - Người dùng: toolbar, bảng và pagination chiếm toàn bộ `settings-content`; modal tạo/điều chỉnh độc lập vì là overlay.

4. **Rà responsive và interaction layout.**
   - Desktop 1440px: cạnh trái/phải của tab bar và cả bốn content tabs thẳng hàng.
   - Tablet 1024px: retrieval sidebar vẫn có đủ nội dung hoặc chuyển đúng breakpoint; provider cards không tràn.
   - Mobile 768px và 375px: tab cuộn ngang, content giữ gutter; filter/table user không ép vỡ viewport; sticky save row không che control cuối.

5. **Xác minh sau thay đổi.**
   - `npm run typecheck`.
   - Smoke HTTP `/settings` trong phiên đăng nhập phù hợp.
   - Nghiệm thu trực quan từng tab tại bốn viewport nêu trên, đối chiếu đường biên container thay vì chỉ kiểm tra từng card.

## File dự kiến

- `components/operations.tsx`
- `app/globals.css`
- `docs/memory/INDEX.md`

## Rủi ro và giới hạn

- Retrieval có sidebar và sticky action row; thay đổi wrapper cần kiểm tra sticky không bị clip bởi `overflow` hoặc parent mới.
- Bảng người dùng cần tiếp tục cuộn ngang trên viewport hẹp; không giảm số cột bằng CSS nếu chưa có quyết định nghiệp vụ.
- Plan này chỉ chuẩn hóa layout Cài đặt, không đổi chức năng provider, retrieval, người dùng hay quyền truy cập.

## Kết quả triển khai

- PASS — `SettingsScreen` có một `.settings-content` bọc cả bốn nhánh tab.
- PASS — tab bar, heading Cài đặt và content dùng cùng contract `1180px`/gutter responsive.
- PASS — Agent, Tri thức, Nhà cung cấp và Quản trị người dùng được giới hạn bởi container chung; provider grid, retrieval sidebar và user table chỉ còn là layout nội bộ.
- PASS — `npm run typecheck` và HTTP `/settings` trả `200`.
- NOT-RUN — nghiệm thu ảnh ở 1440px/1024px/768px/375px cần người dùng xác nhận trực quan trong trình duyệt.

## Trạng thái

Đã triển khai; chờ nghiệm thu UI thủ công.
