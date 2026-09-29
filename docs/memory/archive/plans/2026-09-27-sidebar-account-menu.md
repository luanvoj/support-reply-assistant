# Menu tài khoản tại sidebar

## Mục tiêu

Gộp khối tài khoản ở cuối sidebar thành một CTA duy nhất. Khi người dùng nhấn CTA, menu ngữ cảnh hiển thị đúng hai lựa chọn:

1. **Thông tin người dùng** — chuyển đến `/profile`.
2. **Đăng xuất** — gọi luồng đăng xuất hiện có rồi chuyển đến `/login`.

Mục tiêu là làm rõ hai tác vụ thuộc tài khoản, giảm một dòng hành động rời bên dưới thẻ người dùng, nhưng không thay đổi RBAC hay logic phiên đăng nhập.

## Hiện trạng đã xác minh

- `Shell` trong `components/operations.tsx` lấy tên/vai trò từ `GET /api/profile`; thẻ `.sidebar-account` hiện là link trực tiếp tới `/profile`.
- Nút `.sidebar-logout` nằm riêng dưới thẻ và gọi `POST /api/auth/logout`; khi thành công, trình duyệt được điều hướng tới `/login`.
- CSS hiện hành đã có token và trạng thái hover cho thẻ tài khoản/nút logout. Ở viewport hẹp, phần chữ của sidebar bị ẩn; giải pháp mới phải duy trì được lối vào cho cả hai hành động.

## Phương án đã chốt

- Dùng chính thẻ tài khoản làm **menu trigger**, thay `a` bằng `button` để không vừa điều hướng vừa mở menu trong cùng một thao tác.
- Menu neo với CTA trong sidebar, hiển thị tên/vai trò chỉ để định danh, sau đó là hai hàng hành động cùng kích thước control: “Thông tin người dùng” và “Đăng xuất”.
- “Thông tin người dùng” là liên kết/điều hướng rõ ràng; “Đăng xuất” là button và tái sử dụng hàm logout hiện tại. Không thêm hộp xác nhận vì đây là hành động rõ ràng do người dùng chủ động chọn ở cấp menu; lỗi API vẫn dùng feedback hiện có.
- Menu đóng sau khi chọn một hành động, nhấn Escape, nhấn ra ngoài, hoặc điều hướng. Trigger công bố `aria-expanded`, `aria-controls` và menu có thứ tự focus bằng bàn phím.

## Kế hoạch triển khai

1. **Chuẩn hóa state và semantics trong Shell.** Thêm state mở/đóng menu; thay CTA tài khoản bằng button có tên truy cập được, trạng thái ARIA và ref cần thiết để nhận biết click ra ngoài. Giữ dữ liệu người xem hiện có, không gọi thêm API.
2. **Dựng menu hai hành động.** Tạo menu ngay trong sidebar gồm “Thông tin người dùng” và “Đăng xuất”; liên kết profile đóng menu trước khi chuyển trang, logout đóng menu rồi gọi chính hàm `logout` hiện tại. Bảo vệ trường hợp request lỗi: menu đã đóng, feedback lỗi vẫn hiển thị và người dùng không bị điều hướng sai.
3. **Áp dụng component styling thống nhất.** Bổ sung class có phạm vi sidebar, dùng token màu, height, radius, focus ring và hover hiện có; tránh biến menu thành một card màu khác. Bố cục desktop neo cạnh/dưới CTA không che nav; viewport hẹp giữ trigger và menu đủ rộng để đọc, không dựa vào dòng “Đăng xuất” cũ.
4. **Xóa UI trùng lặp và giữ responsive.** Bỏ `.sidebar-logout` markup/rule không còn dùng, kiểm tra không ảnh hưởng header hay ProfileScreen. Nếu breakpoint cần điều chỉnh, chỉ điều chỉnh trong phạm vi menu tài khoản.
5. **Kiểm tra.** Chạy typecheck; kiểm tra thủ công desktop và mobile: mở/đóng, click ngoài/Escape, focus Tab/Enter/Space, tới `/profile`, logout thành công tới `/login`, và lỗi logout vẫn báo feedback. Kiểm tra role `sales`, `technical`, `admin` vì cả ba đều có quyền xem hồ sơ và tự đăng xuất.

## Rủi ro và giới hạn

- Không nên bọc menu trigger bằng link: click có thể vừa mở menu vừa điều hướng, làm mất tác vụ đăng xuất.
- Click-outside phải không đóng menu trước khi click vào item; handler cần phân biệt trigger/menu container.
- Chưa xác minh thủ công các breakpoint sau thay đổi; đó là hạng mục nghiệm thu, không phải trạng thái PASS hiện tại.

## Tiêu chí hoàn tất

- [x] Một CTA tài khoản duy nhất mở menu gồm đúng hai lựa chọn được yêu cầu.
- [x] “Thông tin người dùng” điều hướng đúng `/profile`; “Đăng xuất” dùng `POST /api/auth/logout` và thành công sẽ về `/login`.
- [x] Không còn nút đăng xuất rời dưới khối tài khoản.
- [x] Menu có focus state, Escape và click ngoài để đóng; trigger công bố trạng thái ARIA.
- [x] Không tạo CTA, màu, typography hay kích thước control mới ngoài system design hiện có.
- [x] `npm run typecheck` PASS.
- [ ] Nghiệm thu thủ công desktop/mobile: mở/đóng, Tab/Enter/Space, điều hướng profile và logout thực tế.

## Trạng thái triển khai

- Đã triển khai trong `components/operations.tsx` và `app/globals.css`.
- Logic logout/API không thay đổi; menu chỉ tái sử dụng luồng có sẵn.
- Nghiệm thu trực quan trong trình duyệt: **chưa chạy**.
