# Quản trị người dùng, hồ sơ cá nhân và 2FA

## Mục tiêu

Chuẩn hóa Cài đặt thành nơi quản trị vận hành thực sự: bỏ hai tab chưa dùng, bổ sung Quản trị người dùng cho Admin và Thông tin người dùng cho từng tài khoản. Hệ thống cần giới hạn quyền đúng ba vai trò, giữ an toàn liên kết dữ liệu khi nhân sự rời đi, đồng thời có cơ chế dọn dữ liệu cá nhân và tệp avatar theo vòng đời rõ ràng.

## Hiện trạng đã xác minh

- Role kỹ thuật hiện là `sales`, `technical`, `admin`; quyền hiện có gần tương ứng Người dùng, Chuyên gia, Quản trị viên nhưng navigation/middleware chưa chặn route theo role.
- Bảng `users` mới có họ tên, email, mật khẩu hash, role, status; chưa có username, avatar, 2FA, session-version hay cơ chế vòng đời tài khoản.
- Nhiều bảng tham chiếu `users`; `knowledge_articles` có `created_by` và `reviewed_by`. Hard delete trực tiếp sẽ vướng foreign key và làm mất dấu vết nghiệp vụ.
- App đang dùng bcrypt để hash mật khẩu. Session là JWT 8 giờ và hiện chưa kiểm tra trạng thái/session version của user trong DB.
- Chưa có abstraction storage; không nên phục vụ upload từ đường dẫn do người dùng kiểm soát.

## Quyết định đề xuất

1. Giữ code role nội bộ để tránh migration enum: `sales` hiển thị **Người dùng**, `technical` là **Chuyên gia**, `admin` là **Quản trị viên**. Chỉ Admin có Cài đặt; Chuyên gia truy cập mọi phần còn lại; Người dùng chỉ có Tổng quan và Trợ lý.
2. “Xóa người dùng” là một **vòng đời ba trạng thái**, không phải soft-delete vĩnh viễn:
   - **Đang hoạt động**: đăng nhập và sử dụng bình thường.
   - **Đã vô hiệu hóa**: áp dụng ngay khi Admin xác nhận xóa. Thu hồi mọi session, TOTP/recovery code và avatar; tài khoản không đăng nhập được. Admin có thể khôi phục trong thời gian giữ lại.
   - **Đã làm sạch**: job định kỳ xử lý sau thời hạn giữ lại cấu hình được (đề xuất mặc định 30 ngày trong giai đoạn đầu). Job xóa dữ liệu định danh và credential: email, username, tên hiển thị, password hash, 2FA, avatar; chỉ giữ một bản ghi tombstone tối thiểu với id cũ, trạng thái `purged` và tên hiển thị “Tài khoản đã xóa”. Tombstone giữ nguyên foreign key/audit nhưng không còn là hồ sơ người dùng có thể sử dụng.
3. Khi vô hiệu hóa, Admin bắt buộc chuyển quyền sở hữu các bài viết đang hoạt động cho một user active trong cùng transaction và ghi `ownership transfer audit`. Hội thoại, lịch sử đánh giá và audit không chuyển chủ sở hữu để tránh sai lệch lịch sử. Ticket đang mở phải được chuyển cho Chuyên gia khác hoặc trả về hàng đợi trước khi tài khoản có thể được làm sạch.
4. Không dùng một thời hạn lưu giữ cho mọi loại dữ liệu. Mặc định 30 ngày chỉ là thời gian hoàn tác cho tài khoản nhân sự; thời hạn cho audit/hội thoại/ticket phải là chính sách riêng, có cấu hình và được công ty xác nhận về pháp lý. Job chỉ làm sạch tài khoản khi các ràng buộc nghiệp vụ đã thỏa; có chế độ xem trước, log từng thay đổi và chạy theo lịch hằng ngày.
5. Bản ghi tombstone là chi phí rất nhỏ và có chủ đích để bảo toàn quan hệ dữ liệu; phần gây phình thực tế là PII, credential, avatar và dữ liệu nghiệp vụ dư thừa — các phần này phải được xóa/pseudonymize theo chính sách. Hard delete vật lý chỉ xem xét sau này khi không còn bất kỳ tham chiếu, backup hay yêu cầu lưu vết nào.
6. Dùng username unique không phân biệt hoa thường; login tương thích cả username lẫn email. Email/username chỉ được giải phóng sau khi tài khoản qua giai đoạn làm sạch để vẫn có thể khôi phục an toàn trong thời gian giữ lại.
7. 2FA là TOTP bằng ứng dụng xác thực. Ở giai đoạn này **tất cả vai trò, kể cả Admin, đều tự nguyện**. Thiết kế setting policy có sẵn hai mode `optional` và `admin_required`, mặc định `optional`; chưa bật ép buộc cho đến khi người dùng quyết định rollout. Bật phải qua QR và xác nhận mã; user tắt cần mật khẩu hiện tại, Admin có thể tắt cho user khác và phải ghi audit.
8. Avatar lưu qua storage adapter, triển khai driver local tại `storage/users/<user-id>/avatar/`; DB chỉ lưu storage key và metadata. Upload tối đa 5 MB, chỉ JPEG/PNG/WebP, kiểm tra nội dung ảnh thật, server sinh tên và chuyển/chuẩn hóa WebP. Đọc avatar qua route có kiểm soát quyền. Sau này có thể đổi driver sang Supabase Storage/S3 mà không đổi API.

## Kế hoạch triển khai

1. **Data model, session và retention lifecycle.** Migration thêm username, avatar metadata, `session_version`, trạng thái/thời điểm `disabled_at`, `purge_after`, `purged_at`, bảng TOTP mã hóa, recovery-code hash và `user_lifecycle_events`. Backfill username từ email có xử lý trùng. Bổ sung session-version/status check ở server để reset mật khẩu, tắt 2FA và vô hiệu hóa tài khoản làm JWT cũ mất hiệu lực.
2. **Dọn tài khoản an toàn.** Tạo service vô hiệu hóa/khôi phục/làm sạch dùng transaction, một command retention có `--dry-run` và `--apply`, cùng nhật ký kết quả. Lúc vô hiệu hóa: kiểm tra không phải self hoặc Admin active cuối cùng, chuyển bài viết, xử lý ticket mở, thu hồi credential/storage. Lúc làm sạch: kiểm tra hạn giữ lại và ràng buộc nghiệp vụ, xóa PII/avatar/2FA rồi tạo tombstone; không hard delete user row.
3. **RBAC và API.** Điều chỉnh permission map/server guard, middleware/navigation và API để Người dùng chỉ vào Tổng quan/Trợ lý; Chuyên gia không vào Cài đặt. Tạo contract CRUD Admin, profile cá nhân, password, avatar, TOTP/login challenge và lifecycle actions. Mọi API kiểm tra owner hoặc Admin ở server.
4. **UI Cài đặt và sidebar.** Bỏ tab Tổng quan/Chính sách dữ liệu; thêm Quản trị người dùng cho Admin và Thông tin người dùng trước Cài đặt. Form profile chỉ sửa avatar/mật khẩu; password meter Yếu/Trung bình/Mạnh (server chỉ nhận từ Trung bình), checklist gợi ý mật khẩu mạnh, flow drag/drop avatar. Modal vô hiệu hóa hiển thị rõ thời hạn có thể khôi phục, người nhận bài viết và xử lý ticket; màn hình danh sách phân biệt Active/Disabled/Purged, có bộ lọc để không biến tombstone thành “người dùng rác”.
5. **Kiểm thử, vận hành và tài liệu.** Test RBAC route/API, uniqueness/backfill username, transfer ownership, last-admin/self-delete guard, ticket queue, session revocation, retention dry-run/apply/idempotency, upload validation 5 MB/path traversal, password và TOTP. Cập nhật API/README/memory và tài liệu vận hành nêu rõ lịch retention, khôi phục và quy trình xem audit.

## Tiêu chí kiểm tra

- [ ] Migration chạy lặp lại an toàn; user cũ có username unique và không mất dữ liệu.
- [ ] Người dùng không thể truy cập route/API ngoài Tổng quan/Trợ lý; Chuyên gia không thể truy cập Cài đặt.
- [ ] Chỉ Admin tạo/sửa/vô hiệu hóa tài khoản; không thể vô hiệu hóa chính mình hoặc Admin active cuối cùng.
- [ ] Vô hiệu hóa có bài viết buộc chọn người nhận; transfer chạy trong transaction và audit lưu nguồn/đích. Ticket mở không còn treo ở tài khoản bị vô hiệu hóa.
- [ ] Session, mật khẩu, 2FA và avatar bị thu hồi ngay khi vô hiệu hóa; khôi phục chỉ hoạt động trước `purge_after`.
- [ ] Retention dry-run không thay đổi dữ liệu; apply chỉ xử lý tài khoản đủ điều kiện, xóa PII/credential/avatar, tạo tombstone và an toàn khi chạy lặp.
- [ ] Password mới khớp xác nhận và đạt Trung bình trở lên ở client/server; các session cũ bị thu hồi.
- [x] Avatar không vượt 5 MB, không chấp nhận file giả mạo, nằm trong thư mục riêng và không có filename do client điều khiển. Evidence: `app/api/profile/avatar`, `lib/storage/user-avatar.ts`, ảnh đầu vào được `sharp` xác minh/chuẩn hóa WebP 512×512; `npm run typecheck` PASS và normalization smoke PASS.
- [ ] 2FA chỉ active sau mã TOTP hợp lệ; tất cả role có thể chọn bật hoặc không bật trong giai đoạn hiện tại; policy `admin_required` chưa được bật mặc định nhưng được test sẵn cho rollout sau.
- [ ] UI mới không tạo biến thể tùy tiện: CTA dùng đúng hierarchy/màu/height/focus state hiện có; bảng, form, modal, badge dùng cùng token về typography, spacing, border và responsive breakpoint; không còn lệch baseline, viền mép trái hay nhãn chồng nhau ở viewport được hỗ trợ.

## Rủi ro và nguyên tắc vận hành

- Thời hạn retention không phải kết luận pháp lý. Công ty cần phê duyệt theo mục đích, nghĩa vụ hợp đồng/pháp luật và từng nhóm dữ liệu; lịch cần bao gồm dữ liệu chính, bản sao, cache, export và backup. ICO khuyến nghị retention schedule theo từng loại thông tin và xóa/anonymize khi không còn cần thiết; OWASP cũng khuyến nghị bao phủ mọi nơi dữ liệu có thể tồn tại. [ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/employment-practices-and-data-protection-keeping-employment-records/collecting-and-keeping-employment-records) · [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- Lifecycle phải gắn với onboarding/offboarding nhân sự, có tự động hóa vô hiệu hóa tài khoản inactive và audit hành động tài khoản; đây là lý do job định kỳ và `user_lifecycle_events` là bắt buộc thay vì để soft-delete vô thời hạn. [NIST AC-2](https://csrc.nist.gov/CSRC/media/Projects/risk-management/800-53%20Downloads/800-53r5/SP_800-53B_derived-OSCAL.pdf)
- Local filesystem cần volume/backup khi triển khai và không phù hợp cho nhiều instance nếu chưa đổi sang object storage.
- TOTP cần thư viện QR/TOTP và khóa mã hóa riêng để bảo vệ secret at rest; không log secret/recovery code. Upload avatar phải kiểm tra true type, giới hạn dung lượng, server-generated filename và lưu tách khỏi web root. [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) · [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

## Phạm vi đã chốt

- 2FA: tự nguyện cho toàn bộ vai trò trong giai đoạn hiện tại. Không bật cưỡng chế Admin cho đến khi có quyết định rollout mới.
- Retention tài khoản: đề xuất mặc định 30 ngày để có cửa sổ khôi phục; thời hạn cuối cùng và thời hạn audit/hội thoại/ticket cần được người phụ trách nghiệp vụ/pháp lý xác nhận trước khi đưa lên production.

## Cập nhật triển khai 2026-09-27

- PASS — Avatar có storage driver local tại `storage/users/<user-id>/avatar/avatar.webp`; tên file do server tạo, thư mục storage bị loại khỏi source control.
- PASS — API owner-only `GET/POST/DELETE /api/profile/avatar`; chỉ nhận JPEG/PNG/WebP tối đa 5 MB, xác minh nội dung ảnh và chuẩn hóa WebP 512×512 trước khi lưu.
- PASS — Avatar hiển thị tại Hồ sơ và sidebar. Bấm avatar trong Hồ sơ mở modal theo design system để kéo-thả/chọn tệp, xem trước hoặc xóa ảnh.
- PASS — Vô hiệu hóa/làm sạch tài khoản gọi xóa avatar vật lý sau khi thu hồi metadata/credential.
- BLOCKED — Cần nghiệm thu thủ công upload/xóa bằng browser session thực để xác nhận thao tác UI và quyền owner-only runtime.
