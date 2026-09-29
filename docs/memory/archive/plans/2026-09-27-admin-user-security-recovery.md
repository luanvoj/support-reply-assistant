# Quản trị viên khôi phục bảo mật tài khoản người dùng

## Kết quả mong đợi

Quản trị viên có thể xử lý hai tình huống hỗ trợ tài khoản ngay trong **Quản trị người dùng**:

1. Đặt lại mật khẩu của một tài khoản đang hoạt động bằng mật khẩu mới và ô xác nhận; checklist, mức độ mạnh và kiểm tra phía máy chủ phải giống hệt luồng tạo người dùng/đổi mật khẩu cá nhân.
2. Tắt 2FA cho tài khoản đang bật để người dùng có thể thiết lập lại TOTP; thao tác này phải có xác nhận rõ ràng, thu hồi phiên và lưu vết audit.

Modal **Điều chỉnh người dùng** chỉ còn một CTA `Hủy` ở footer. CTA Hủy ở header hiện chỉ đưa người dùng sang trạng thái tạo mới, không có giá trị trong luồng điều chỉnh, nên bị loại bỏ.

## Hiện trạng đã xác minh

- `passwordSchema`, `passwordChecklist` và `passwordStrength` trong `lib/auth/users.ts` đã là policy chung: tối thiểu 8 ký tự, chữ hoa, chữ thường và ký tự đặc biệt; server chỉ nhận mức Trung bình trở lên.
- `POST /api/users` dùng policy trên khi tạo user; `PATCH /api/profile` đổi mật khẩu cá nhân, đồng thời tăng `session_version`.
- `users` đã có `mfa_enabled_at`, `session_version`; `user_mfa_totp` chứa secret TOTP được mã hóa. User tự tắt 2FA qua `/api/profile/mfa` bằng mật khẩu hiện tại, còn Admin chưa có API recovery.
- `GET /api/users` hiện không trả trạng thái 2FA. `PATCH /api/users/[id]` chỉ cập nhật thông tin/vai trò; `DELETE` là lifecycle vô hiệu hóa và đã xóa TOTP.
- Modal điều chỉnh ở `components/operations.tsx` đang hiển thị hai CTA Hủy; CTA ở header chỉ xuất hiện khi đang điều chỉnh và reset form về tạo mới.
- Không cần migration: các trường, bảng MFA, hàm băm mật khẩu, encryption và audit table đã tồn tại.

## Quyết định phạm vi

- Chỉ Admin gọi được API recovery. Admin **không** reset mật khẩu hoặc tắt 2FA của chính mình từ workspace này: tài khoản hiện hành phải dùng luồng **Thông tin người dùng** với mật khẩu hiện tại. Quy tắc này tránh bypass xác minh tự phục vụ và giảm rủi ro tự khóa phiên ngoài ý muốn.
- Chỉ thao tác trên tài khoản `active`; disabled/purged không có CTA recovery.
- Reset mật khẩu không yêu cầu mật khẩu cũ của người dùng đích, nhưng bắt buộc policy chung, xác nhận trùng khớp, hash ở server, tăng `session_version` và ghi lifecycle event. Vì vậy tất cả phiên cũ của tài khoản đích bị thu hồi.
- Tắt 2FA là action recovery có xác nhận trong UI, xóa bản ghi `user_mfa_totp`, đặt `mfa_enabled_at = NULL`, tăng `session_version` và audit người thực hiện. Không trả secret, QR hay mã khôi phục cho Admin.
- Trạng thái 2FA chỉ là metadata (`Đang bật`/`Chưa bật`), không tiết lộ secret hay thời điểm xác thực không cần thiết.

## Impact map

| Liên kết | Thay đổi / bằng chứng |
| --- | --- |
| Runtime/API | Thêm hai contract Admin riêng cho reset mật khẩu và tắt 2FA; không overload `PATCH /api/users/[id]` vốn là cập nhật hồ sơ. |
| Persistence | Không migration. Update `users.password_hash`, `session_version`, `mfa_enabled_at`; delete `user_mfa_totp`; insert `user_lifecycle_events` trong transaction. |
| Cấu hình | Dùng trực tiếp policy mật khẩu chung; không thêm ngưỡng hoặc cấu hình mới. |
| RBAC | `requireRole("admin")` ở server; chặn self-target và target không active. UI chỉ hiển thị với Admin. |
| UI/CTA | Thêm nhóm **Bảo mật tài khoản** trong modal điều chỉnh, checklist nhất quán và dialog xác nhận tắt 2FA; bỏ CTA Hủy ở header, giữ CTA Hủy footer. |
| Chỉ số/audit | Ghi actor, target và loại action; không lưu plaintext mật khẩu/TOTP. Dashboard không bị ảnh hưởng. |
| Tài liệu | Cập nhật API, README/Hướng dẫn sử dụng và memory để nêu rõ Admin recovery cùng tác động thu hồi phiên. |
| Kiểm thử | Unit/API cho policy, RBAC, self/disabled target, session revocation, xóa TOTP/audit; typecheck/build và nghiệm thu browser cho modal/focus/responsive. |

## Kế hoạch triển khai

1. **Mở rộng contract danh sách và API recovery.** Bổ sung `mfaEnabled` vào dữ liệu user trả về. Tạo endpoint Admin riêng để đặt lại mật khẩu và endpoint Admin riêng để tắt 2FA; parse dữ liệu bằng `passwordSchema` + confirmation, khóa/cập nhật transaction, kiểm tra target active/self-target, tăng `session_version` và chuẩn hóa mã lỗi.
2. **Bảo toàn phiên, credential và audit.** Reset password sẽ băm mật khẩu mới, thu hồi session cũ và ghi event `password_reset_by_admin`; tắt MFA sẽ xóa factor, thu hồi session và ghi `mfa_disabled` với actor Admin. Hai action không được ghi password, secret hay mã OTP vào response/log/audit.
3. **Thiết kế lại modal Điều chỉnh.** Giữ nhóm Thông tin tài khoản; thêm nhóm Bảo mật tài khoản tách biệt với reset mật khẩu (hai input, feedback khớp, checklist và strength dùng component/style hiện có) và trạng thái 2FA. `Tắt 2FA` chỉ hiện khi factor đang bật, mở confirmation dialog nêu rõ user sẽ phải đăng nhập/thiết lập lại. Bỏ Hủy header; footer là điểm hủy duy nhất.
4. **Đồng bộ dữ liệu và trạng thái UI.** Sau action thành công, refresh list/modal từ server, xoá giá trị mật khẩu khỏi state và thông báo kết quả. CTA disabled khi đang gửi hoặc input không hợp lệ; không optimistic-update trạng thái 2FA/mật khẩu.
5. **Kiểm tra và tài liệu.** Test API Admin/non-Admin, self-target, disabled target, mismatch/policy yếu, session version, delete factor, audit và không rò secret; chạy typecheck/build, kiểm tra modal ở desktop/mobile bằng browser session khi có. Cập nhật `docs/API.md`, README, hướng dẫn sử dụng và INDEX sau kết quả thực tế.

## Tiêu chí nghiệm thu

- [ ] Reset mật khẩu dùng cùng 4 điều kiện checklist, xác nhận trùng khớp và strength như tạo user mới; server từ chối mọi payload bypass UI.
- [ ] Sau reset thành công, các session cũ của user đích không còn hợp lệ; audit không chứa mật khẩu.
- [ ] Chỉ Admin có thể recovery và không thể dùng recovery để tự thay mật khẩu/tắt 2FA; account disabled/purged bị từ chối.
- [ ] CTA tắt 2FA chỉ có khi 2FA đang bật; sau khi xác nhận, factor bị xóa, trạng thái cập nhật từ server, session cũ bị thu hồi và audit ghi đúng actor.
- [ ] Modal Điều chỉnh chỉ còn một CTA Hủy ở footer; không có thao tác nào ngầm chuyển sang tạo user mới.
- [ ] CTA, modal, border, focus state, control height và responsive dùng token/design system hiện hành; không có nhãn hay CTA mô tả hành vi chưa tồn tại.

## Rủi ro còn mở

- Admin recovery là quyền mạnh: cần lưu audit đủ để điều tra, nhưng không lưu bất kỳ credential nhạy cảm nào.
- Tắt 2FA phải được diễn đạt là khôi phục quyền truy cập chứ không phải thao tác thường ngày; confirmation giúp giảm lỗi thao tác.
- Chưa có browser session trong phiên hiện tại, nên nghiệm thu tương tác thực tế/focus/viewport phải được ghi là NOT-RUN cho đến khi có môi trường phù hợp.

## Cập nhật triển khai 27-09-2026

- Đã bổ sung `mfaEnabled` vào danh sách người dùng và hai API recovery dành riêng cho Admin: `POST /api/users/:id/password` và `DELETE /api/users/:id/mfa`.
- Hai API đều chặn self-target và tài khoản không còn hoạt động; thay đổi được thực hiện trong transaction, tăng `session_version`, không trả credential/TOTP và ghi audit với actor.
- Modal **Điều chỉnh người dùng** có nhóm **Bảo mật tài khoản** với checklist mật khẩu chung, xác nhận trùng khớp, trạng thái 2FA, dialog xác nhận tắt 2FA; CTA Hủy ở header đã được loại bỏ.
- Đã chạy `npm run typecheck` và `npm run db:migrate` thành công. `npm run build` biên dịch/type-check thành công nhưng dừng ở bước prerender `/unanswered` với lỗi có sẵn `Cannot read properties of undefined (reading 'definition')`; cần xử lý riêng lỗi prerender này trước khi dùng build như bằng chứng phát hành.
- Nghiệm thu trình duyệt cho modal, dialog, focus và responsive: **NOT-RUN** (chưa có browser session trong phiên).
