# Tách vô hiệu hóa, khôi phục và xóa tài khoản có người kế thừa

## Kết quả mong đợi

Quản trị viên có ba thao tác độc lập trong **Quản trị người dùng**:

1. **Vô hiệu hóa**: chỉ khóa đăng nhập ngay lập tức bằng `status=disabled` và tăng `session_version`. Mọi hồ sơ, mật khẩu, avatar, 2FA và dữ liệu vận hành vẫn được giữ nguyên.
2. **Kích hoạt lại**: khôi phục tài khoản `disabled` về `active`; không đổi credential, 2FA, avatar hay dữ liệu. Người dùng đăng nhập lại bằng thông tin cũ.
3. **Xóa tài khoản**: là thao tác không đảo ngược, bắt buộc chọn một tài khoản kế thừa hợp lệ trước khi xác nhận. Hệ thống chuyển quyền vận hành rồi ẩn danh hóa hồ sơ đích ngay trong một transaction.

## Hiện trạng đã xác minh

- `DELETE /api/users/:id` hiện gọi là “vô hiệu hóa” nhưng đồng thời chuyển bài viết/ticket, xóa TOTP/avatar và đặt `purge_after` 30 ngày. Điều này trái với ý nghĩa mới của thao tác khóa đăng nhập.
- Không có API hay CTA `disabled → active`, dù UI cũ nói có thể khôi phục.
- `scripts/user-retention.ts` chỉ chạy khi được gọi thủ công/scheduler với `--apply`; hiện không có scheduler trong codebase. Sau hạn, script có thể ẩn danh hóa tài khoản disabled nhưng vẫn giữ các ràng buộc dữ liệu.
- Các quan hệ user đã rà: quyền vận hành gồm `knowledge_articles.created_by/reviewed_by` và `unanswered_questions.assigned_to`; audit/lifecycle, lịch sử review, import, cấu hình, batch gộp và feedback cần giữ actor lịch sử. Hội thoại có `conversations.user_id` và có thể chứa nội dung riêng tư, không được chuyển cho người kế thừa chỉ vì xóa nhân sự.

## Quyết định phạm vi

- Bỏ hoàn toàn retention 30 ngày đối với thao tác **Vô hiệu hóa**: `purge_after` luôn `NULL`; không gọi xóa avatar/TOTP, không chuyển bất kỳ quyền nào.
- `Kích hoạt lại` chỉ dành cho Admin, chặn self-target và tombstone `purged`; action tăng `session_version` để phiên cũ luôn không hợp lệ, giữ nguyên 2FA để login kế tiếp vẫn đúng policy bảo mật.
- `Xóa tài khoản` sẽ dùng `DELETE /api/users/:id` với payload `successorId`. Đây là hành động ẩn danh hóa ngay, không dựa vào scheduler. Người kế thừa phải active và được server xác minh theo thứ tự:
  - `sales` → ưu tiên `sales`, rồi `technical`, rồi `admin`.
  - `technical` → ưu tiên `technical`, rồi `admin`.
  - `admin` → chỉ `admin`; vẫn không được xóa Admin active cuối cùng.
- Chuyển **trách nhiệm vận hành** của bài viết (người tạo/duyệt) và ticket đang mở (người được phân công). Không thay actor của audit/lifecycle/review/import/merge hay chuyển hội thoại riêng tư; tombstone vẫn giữ foreign key để truy vết. Đây là giới hạn bảo mật cần thiết của “kế thừa dữ liệu”.
- Xóa sẽ xóa TOTP và avatar vật lý, thay PII/credential bằng tombstone, tăng `session_version`, không giải phóng email/username cũ và ghi audit gồm actor, successor, role source/destination và số đối tượng đã chuyển. Không cần migration vì các cột/status/tombstone đã tồn tại; cần mở rộng CHECK event type idempotently.

## Impact map

| Liên kết | Thay đổi và cách tránh xung đột |
| --- | --- |
| Runtime/API | Tách `POST /disable`, `POST /restore`, `GET /deletion-candidates` và giữ `DELETE` chỉ cho xóa có successor. Không overload PATCH hồ sơ hay profile self-service. |
| Persistence | Mọi disable/restore/delete lock target trong transaction. Delete kiểm tra hierarchy từ DB, chuyển ownership vận hành trước khi tombstone; không chạy user-retention trên disabled nữa. |
| Cấu hình/vận hành | Bỏ claim retention 30 ngày và scheduler user-retention khỏi lifecycle account; script được chuyển thành no-op/report để không thể làm sạch nhầm tài khoản chỉ bị khóa. |
| RBAC | Tất cả action server-side `requireRole("admin")`; chặn self-target, target không active khi disable/delete, và target không disabled khi restore. Last-admin guard vẫn ở server. |
| UI/CTA | Active: `Điều chỉnh`, `Vô hiệu hóa`, `Xóa tài khoản…`; Disabled: `Kích hoạt lại`; Purged: không có CTA. Modal xóa tải ứng viên từ server, hiển thị logic ưu tiên/cảnh báo không đảo ngược, dùng modal/button/pill token sẵn có. |
| Dữ liệu liên quan | Knowledge và ticket mở có successor; historical audit/review/import/merge/feedback cùng hội thoại không đổi actor/owner để không xuyên quyền hay sai lịch sử. |
| Tài liệu/chỉ số | API, README, Hướng dẫn, memory bỏ retention cũ; lifecycle audit ghi `disabled`, `restored`, `ownership_transferred`, `purged`. Dashboard không phụ thuộc user status nên không đổi. |
| Kiểm thử | Typecheck, migration, API guards/hierarchy/self/last-admin, hành vi tombstone/ownership, diff check; browser modal/focus/responsive là NOT-RUN nếu không có browser session. |

## Kế hoạch triển khai

1. **Chuẩn hóa contract lifecycle ở server.** Thêm API Admin riêng để vô hiệu hóa, kích hoạt lại và tải ứng viên kế thừa; sửa delete thành xóa vĩnh viễn về nghiệp vụ với `successorId` bắt buộc. Tất cả action khóa row, kiểm tra role hierarchy và trạng thái từ DB.
2. **Bảo toàn dữ liệu và bảo mật.** Vô hiệu hóa/khôi phục chỉ đổi status/session/audit. Xóa chuyển article/ticket vận hành, xóa factor/avatar, tombstone PII ngay trong transaction và ghi audit; cập nhật retention script để không thể purge một tài khoản chỉ bị disabled.
3. **Thiết kế lại UI quản trị.** Thay nhãn/tác vụ theo trạng thái, thêm CTA Kích hoạt lại và modal Xóa tài khoản tách biệt. Modal chỉ cho phép chọn successor từ API, diễn giải thứ tự quyền và các dữ liệu không chuyển; không để CTA mô tả hành vi không tồn tại.
4. **Đồng bộ dữ liệu, docs và kiểm tra.** Refresh server state sau action; cập nhật API/README/Hướng dẫn/INDEX. Chạy typecheck, migration, build, diff check và ghi rõ browser/manual branches chưa chạy.

## Tiêu chí nghiệm thu

- [ ] Vô hiệu hóa chặn login/thu hồi phiên nhưng giữ nguyên avatar, TOTP, password hash, PII, bài viết và ticket.
- [ ] Kích hoạt lại chỉ khả dụng với `disabled`, phục hồi đăng nhập bằng credential cũ và vẫn yêu cầu 2FA nếu trước đó đã bật.
- [ ] Xóa bắt buộc successor hợp lệ; server từ chối self, cross-hierarchy, inactive recipient, target không active và Admin active cuối cùng.
- [ ] Successor ranking đúng sales → technical → admin, technical → admin và admin → admin; UI không tự suy luận ứng viên ngoài dữ liệu server.
- [ ] Xóa chuyển bài viết/ticket mở, giữ audit/hội thoại lịch sử, anonymize credential/PII/avatar/2FA, và không thể khôi phục tombstone.
- [ ] Danh sách không còn ghi “làm sạch sau” cho tài khoản disabled; disabled/purged không có CTA recovery sai ngữ cảnh.
- [ ] API, README, Hướng dẫn và memory đồng bộ với hành vi thực tế; typecheck/migration/diff check pass.

## Cập nhật triển khai 28-09-2026

- Đã tách API `POST /disable` và `POST /restore` khỏi `DELETE`; disable giữ nguyên dữ liệu/bảo mật, restore chỉ mở lại login.
- `DELETE` hiện yêu cầu `successorId`, xác minh hierarchy ở server, chuyển article/ticket mở và tombstone PII/credential/avatar/2FA trong transaction.
- UI danh sách đã có CTA Kích hoạt lại và modal Xóa tài khoản. Nghiệm thu browser/responsive còn **NOT-RUN**; cần kiểm tra thực tế danh sách ứng viên ở dữ liệu nhiều trang trước khi phát hành.
