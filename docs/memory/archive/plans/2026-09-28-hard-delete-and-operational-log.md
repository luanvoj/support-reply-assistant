# Xóa hẳn tài khoản và nhật ký vận hành có thời hạn

## Kết quả mong đợi

- Xóa tài khoản là **hard delete**: sau khi dữ liệu vận hành đã được chuyển cho người kế thừa, bản ghi `users` và mọi credential/ảnh/2FA liên quan biến mất hoàn toàn; danh sách người dùng không còn tombstone.
- Có tab **Nhật ký vận hành** trong Cài đặt dành cho Admin: xem các thay đổi cấu hình, tri thức, lifecycle người dùng và đăng nhập; tuyệt đối không ghi nội dung hoặc metadata chat.
- Admin cấu hình số ngày lưu log. Job retention dọn log quá hạn theo lịch, tránh tăng dung lượng vô hạn.
- Mỗi dòng log phải là một câu hành động dễ đọc, ví dụ **“Trunght đã xóa tài khoản huongtnl”** hoặc **“Trunghn đã đăng nhập lúc 09:42, 28/09/2026”**, đồng thời vẫn có metadata cấu trúc để lọc/điều tra.

## Phát hiện cần xử lý trước

Hard delete không thể chỉ đổi `DELETE FROM users`: hiện nhiều foreign key trỏ tới `users`, gồm lifecycle event, audit tri thức, cấu hình, import, merge, review, feedback, ticket và conversation. Xóa trực tiếp sẽ fail FK hoặc, nếu cascade sai, làm mất dữ liệu vận hành.

Do đó Log mới phải là kho lưu vết độc lập: mỗi event lưu `actor_snapshot` (tên/role tại thời điểm thao tác), `target_snapshot`, action, phạm vi và payload đã redaction; `actor_user_id`/`target_user_id` là nullable FK `ON DELETE SET NULL`. Khi user bị xóa, log vẫn đọc được nhưng không còn PII sống hay dependency chặn delete.

UI không hiển thị JSON thô. API trả thêm `summary` do server tạo từ action code và snapshot, cùng thời điểm, category, severity và chi tiết mở rộng đã redaction. Vì vậy dòng log vẫn đọc đúng sau hard-delete: tên hiển thị tại thời điểm xảy ra hành động không cần tra ngược bảng `users`.

## Quyết định phạm vi

1. **Dữ liệu kế thừa**: chuyển ownership của bài viết, yêu cầu chuyên gia đang mở, cấu hình/batch/công việc đang vận hành theo hierarchy đã chốt. Audit lịch sử được copy/snapshot vào log mới, không đổi actor cũ thành người kế thừa.
2. **Dữ liệu không chuyển**: hội thoại, messages và feedback chat không được ghi trong Log, không hiển thị lại và không được cấp quyền cho successor. Khi hard-delete user, các conversation/message/feedback thuộc user này bị xóa theo chính sách riêng trong cùng transaction hoặc FK cascade đã kiểm tra; đây là lựa chọn bảo vệ nội dung hội thoại.
3. **Xóa user**: sau khi transfer và snapshot log thành công, xóa factor/avatar và mọi row phụ thuộc, sau đó `DELETE users`. Không có `purged`, `purge_after`, CTA hay retention account nữa.
4. **Log retention**: cấu hình Admin `retentionDays` (mặc định đề xuất 90, giới hạn 7–3650); purge job chỉ xóa log quá hạn. Không có secret, password, API key, OTP, avatar bytes, nội dung chat hoặc raw request body trong log.

## Impact map

| Liên kết | Kế hoạch xử lý |
| --- | --- |
| Runtime/API | Tách delete account thành preflight successor + hard-delete transaction; thêm API log list/settings và login-event recorder. |
| Persistence/migration | Tạo `operational_logs`, `operational_log_settings`; đổi/kiểm tra FK user theo `SET NULL` hoặc chuyển owner trước delete; bỏ lifecycle tombstone/retention account. |
| RBAC | Chỉ Admin xem log/đổi retention/xóa account; server kiểm tra hierarchy và last-admin. |
| UI/CTA | Tab Nhật ký vận hành trong Cài đặt, mỗi row có câu tóm tắt actor–action–target, thời điểm và badge category; filter action/thời gian/pagination; details drawer chỉ mở metadata redaction. Settings user không hiển thị purged. Xóa là modal danger có successor và hậu quả rõ. |
| Cấu hình | Retention log là config server-validated, không áp dụng lên chat hoặc dữ liệu tri thức. |
| Chỉ số/tài liệu | Log lifecycle/config/knowledge/login; Dashboard không đọc log. Cập nhật API/README/Hướng dẫn/DEPLOYMENT cho scheduler. |
| Kiểm thử | FK hard-delete, rollback transfer, last-admin/hierarchy, redaction, log retention/idempotency, pagination/RBAC, no-chat invariant. |

## Kế hoạch triển khai

1. Lập migration inventory FK thật trên database, tạo log độc lập và helper ghi log/redaction; chuyển các lifecycle/config/knowledge/login event hiện có sang helper.
2. Refactor delete user thành transaction: lock target/successor, transfer ownership hợp lệ, snapshot audit cần giữ, dọn records phụ thuộc và avatar, hard-delete user; bỏ trạng thái `purged`/script retention user.
3. Thêm API log/settings/retention runner và cấu hình scheduler Vibe Host; server enforce retention range/RBAC, tạo summary actor–action–target từ snapshot và không log chat/secret.
4. Thêm tab Nhật ký vận hành theo design system: row tóm tắt dễ đọc, thời điểm, category, filter/pagination/empty state và details redaction; thêm cấu hình retention, cập nhật CTA/nội dung xóa user để khớp hard-delete.
5. Kiểm thử migration trên dữ liệu có quan hệ, rollback transaction, xóa/khôi phục/vô hiệu hóa, retention, RBAC và browser states; cập nhật docs/memory theo evidence.

## Rủi ro và quyết định còn mở

- Hard delete là không thể hoàn tác và phải được backup/approval vận hành trước production. Không chạy migration destructive hoặc scheduler production trong scope plan.
- Cần chốt chính sách cho conversation của user bị xóa: kế hoạch đề xuất xóa hẳn vì user yêu cầu không giữ truy vết và vì successor không nên thấy chat riêng. Nếu doanh nghiệp phải lưu chat theo pháp lý, cần policy riêng trước khi triển khai.
- Không thể gọi đây là “không mất dữ liệu” theo nghĩa tuyệt đối: dữ liệu vận hành được transfer, chat/account PII bị xóa theo yêu cầu; log chỉ giữ mô tả thao tác đã redaction.
