# Lọc ngày, xuất Nhật ký vận hành và xác thực email tạo người dùng

> Trạng thái: đã triển khai 29/09/2026 — đã kiểm tra typecheck, build và smoke tạo CSV/XLSX; chưa có browser/RBAC nghiệm thu với dữ liệu thật trong phiên này.

## Kết quả mong đợi

- Admin chọn **Tùy chọn ngày** sẽ thấy và dùng được ngày bắt đầu/kết thúc; danh sách và tệp xuất luôn cùng bộ lọc loại hoạt động, thời gian.
- Có một CTA **Xuất dữ liệu** với hai định dạng tải xuống: Excel (`.xlsx`) và CSV (`.csv`). Tệp gồm tối thiểu: `Thời điểm` (`dd/MM/yyyy`), `Thời gian` (`HH:mm:ss`), `Người dùng` (email), `Hành động`.
- Tạo người dùng mới yêu cầu một email duy nhất, đúng định dạng ở cả UI và API; lỗi phải gắn đúng trường email.

## Hiện trạng và nguyên nhân

- `GET /api/operational-logs` đã xác thực `from`/`to`, lọc server-side theo ranh giới ngày `Asia/Saigon` và phân trang. `OperationalLogSection.changeRange("custom")` chỉ đổi state rồi trả về, không render input ngày, vì vậy request không có `from`/`to`.
- Log hiện lưu `actor_snapshot` chủ yếu có tên, username và role; email không bảo đảm có trong snapshot. Join với tài khoản hiện tại không đủ tin cậy cho lịch sử vì tài khoản có thể bị ẩn danh/xóa theo lifecycle.
- `POST /api/users` đã dùng `z.string().trim().email().max(254)` và unique key cơ sở dữ liệu. Form tạo người dùng có `type="email"`, nhưng chưa có `required`, thông báo lỗi tại field hoặc chặn submit thân thiện trước request.

## Impact map

| Liên kết | Xử lý |
| --- | --- |
| UI/CTA | Render `Từ ngày`/`Đến ngày` chỉ khi range `custom`; reset trang, validate range trước tải/xuất, giữ trạng thái loading và disabled. Thêm menu/nút chọn Excel hoặc CSV cạnh bộ lọc. |
| API/RBAC | Giữ Admin-only. Tái sử dụng cùng parser và builder điều kiện filter cho list/export; endpoint export phải giới hạn/sanitize query, không nhận email/filter tùy ý. |
| Persistence/history | Không cần migration cho export. Mở rộng `actor_snapshot` mới với email; khi xuất log cũ không có email, dùng giá trị minh bạch `Không còn lưu` thay vì suy đoán. |
| Privacy | Chỉ xuất metadata log hiện được admin xem; không xuất `details`, nội dung chat, password, API key, OTP hoặc avatar. Không khôi phục email của tài khoản đã bị ẩn danh. |
| User management | Bổ sung `required`, help/error cho email trong modal tạo; server schema và unique constraint vẫn là nguồn bảo vệ cuối cùng. Không làm yếu xác thực ở luồng sửa người dùng. |
| Tài liệu/kiểm thử | Cập nhật API contract export và hướng dẫn quản trị; test filter/date boundary, payload CSV/XLSX, RBAC, email invalid/empty/duplicate. |

## Kế hoạch triển khai

1. Tách chuẩn hóa filter log (`category`, `from`, `to`) và điều kiện SQL dùng chung trong lớp server; dùng lại cho `GET /api/operational-logs` và endpoint export admin-only. Export toàn bộ kết quả đúng filter, có giới hạn an toàn/phản hồi lỗi range như list, không chỉ xuất trang hiện tại.
2. Tạo endpoint xuất theo định dạng được allow-list (`csv` hoặc `xlsx`), đặt `Content-Disposition` filename có khoảng ngày; format các mốc `created_at` theo `Asia/Saigon` thành bốn cột yêu cầu. CSV phải UTF-8 BOM và escape RFC 4180; XLSX tạo worksheet cột cơ bản, không ghi dữ liệu nhạy cảm.
3. Hoàn thiện `OperationalLogSection`: hiển thị hai input `type=date` khi chọn `custom`, reset page mỗi lần đổi một mốc, báo lỗi `Từ ngày` lớn hơn `Đến ngày`, và cho export sử dụng đúng query state. CTA vô hiệu khi range invalid/loading/exporting; không đổi retention setting hay pagination hiện có.
4. Mở rộng `getUserLogSnapshot` và các nơi tự tạo actor snapshot để ghi email cho log mới. Export lấy email từ snapshot; chỉ fallback email tài khoản hiện hữu khi thích hợp, còn record lịch sử thiếu dữ liệu/đã ẩn danh phải ghi `Không còn lưu`.
5. Hoàn thiện form tạo người dùng: email bắt buộc, `autoComplete=email`, validate client-side một địa chỉ duy nhất theo HTML constraint/API feedback; map lỗi Zod `email` và conflict email về field, trong khi API/DB tiếp tục chặn request bypass UI. Cập nhật `docs/API.md` và hướng dẫn quản trị.
6. Kiểm chứng: typecheck/build; API smoke cho admin/non-admin, today/7/30/all/custom, range ngược/invalid, đầu-cuối ngày theo `Asia/Saigon`, category + range, CSV quote/Unicode và XLSX đọc lại đủ bốn cột; UI desktop/mobile cho custom date và form email trống/sai/trùng/hợp lệ.

## Rủi ro và quyết định mở

- Dữ liệu log lịch sử không chứa email không thể được tái tạo an toàn sau khi tài khoản bị ẩn danh. Kế hoạch mặc định hiển thị `Không còn lưu` cho trường hợp đó.
- Tệp export có thể lớn hơn pagination. Endpoint sẽ xuất toàn bộ phạm vi nhưng cần chốt giới hạn số dòng hoặc cơ chế job khi retention tối đa 3.650 ngày tạo tệp lớn; đề xuất bắt đầu với giới hạn server rõ ràng và thông báo người dùng khi vượt ngưỡng.
- Phạm vi này không sửa retention hoặc xóa log; export chỉ là read-only và vẫn tuân theo quyền Admin.
