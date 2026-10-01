# SMTP và OTP email cho quên mật khẩu

**Trạng thái:** Đã triển khai trong workspace — chưa nghiệm thu gửi email thật do chưa có SMTP credential.

## Kết quả mong đợi

- Quản trị viên cấu hình và kiểm tra SMTP từ **Cài đặt → Cấu hình SMTP** cho Gmail hoặc SMTP chuẩn khác, không đưa mật khẩu SMTP vào client/API GET/log.
- Tại trang đăng nhập, **Quên mật khẩu?** mở luồng nhập email. Với tài khoản đang hoạt động có email gửi được, hệ thống gửi OTP 6 số và cho phép đặt mật khẩu mới sau khi OTP hợp lệ.
- Với địa chỉ không thể gửi được theo chính sách domain hoặc khi SMTP trả lỗi giao nhận, UI thông báo rõ: email không thể nhận xác thực và cần liên hệ quản trị viên.
- OTP, mật khẩu mới, SMTP password, nội dung email và thông tin xác thực không xuất hiện ở browser log, operational log hay API response.

## Hiện trạng đã xác minh

- Đăng nhập hiện chỉ có email/tên đăng nhập và password; CTA **Quên mật khẩu?** mới chỉ hiển thị một thông báo liên hệ quản trị viên (`app/login/page.tsx`). Chưa có API reset password qua email.
- `users` đã có email, `password_hash`, `status`, `session_version`, MFA/TOTP và lifecycle audit. Đổi/reset mật khẩu hiện tăng `session_version`, là cơ chế thu hồi phiên đúng để tái sử dụng.
- `lib/security/secrets.ts` mã hóa secret at rest bằng `SECRETS_ENCRYPTION_KEY`; AI provider đã dùng pattern API Admin-only, secret chỉ write-only và migration idempotent trong `scripts/migrate.ts`.
- `lib/security/rate-limit.ts` đã có bucket PostgreSQL dùng HMAC key và limiter login/MFA. Chưa có scope cho reset password.
- Chưa có thư viện SMTP trong `package.json`; không có bảng SMTP hay reset OTP.

## Phạm vi và contract đề xuất

### 1. Cấu hình SMTP

Thêm singleton `smtp_settings` qua migration idempotent, gồm host, port, chế độ TLS (`secure` cho SMTPS/465 và STARTTLS cho 587), username, `password_encrypted`, sender email/name, trạng thái cập nhật và actor cập nhật. Secret được mã hóa bằng helper hiện có; GET chỉ trả trạng thái đã cấu hình và metadata không nhạy cảm.

Thêm API Admin-only:

- `GET /api/settings/smtp`: metadata cấu hình, không bao giờ trả password.
- `PUT /api/settings/smtp`: validate host/port/TLS/sender/credential, ghi transaction và operational audit dạng redacted.
- `POST /api/settings/smtp/test`: kiểm tra kết nối và xác thực của cấu hình đang nhập, trước khi lưu.
- `POST /api/settings/smtp/send-test`: sau khi lưu, Admin nhập email nhận và gửi một email test qua cấu hình SMTP đã lưu; action được audit nhưng không ghi địa chỉ người nhận.

Thêm tab **Cấu hình SMTP** kế bên các tab Cài đặt hiện có. Form password write-only: để trống khi cập nhật nghĩa là giữ secret cũ; form nêu rõ thiết lập Google dùng App Password, không dùng mật khẩu Google thông thường.

### 2. Persistence và dịch vụ gửi OTP

Thêm bảng `password_reset_requests` (tên có thể điều chỉnh khi triển khai): request UUID, user id, email snapshot, `otp_hash` HMAC server-side, trạng thái gửi/đã dùng/hết hạn, số lần xác minh, `expires_at`, `consumed_at`, timestamps. Không lưu OTP rõ; chỉ một yêu cầu đang hiệu lực cho một user, request mới sẽ vô hiệu request cũ.

Tạo mailer server-only dùng `nodemailer` (và type phù hợp), đọc/decrypt SMTP config ở server, dựng nội dung email text/HTML tối thiểu và gửi OTP 6 số do CSPRNG sinh ra. Tách service để route không biết credential SMTP; chuẩn hóa lỗi gửi thành thông báo nghiệp vụ, không lộ host/password/response SMTP.

### 3. Luồng public quên mật khẩu

- `POST /api/auth/password-reset/request`: nhận email, chuẩn hóa, áp dụng rate-limit global + identity; kiểm tra account `active` và email. Với request hợp lệ, tạo request, gửi OTP, rồi đặt cookie challenge `httpOnly`, `sameSite=lax`, TTL ngắn, chứa request id được ký; browser không nhận OTP hay reset token raw.
- `POST /api/auth/password-reset/confirm`: nhận OTP 6 số, password mới và confirmation. Route yêu cầu challenge cookie, khóa request/user trong transaction, so HMAC constant-time, giới hạn số lần sai, kiểm tra expiry/consumed/user active, hash password mới, tăng `session_version`, đánh dấu OTP đã dùng và xóa cookie. Sau thành công chỉ xóa rate-limit identity của user đó, không xóa bucket global/IP.
- UI Login chuyển CTA **Quên mật khẩu?** thành modal/stepper: nhập email → thông báo gửi OTP → nhập OTP, mật khẩu mới, confirmation/checklist → thành công quay về đăng nhập. Trạng thái loading, cooldown gửi lại và error rõ ràng theo contract API.
- Nếu tài khoản đã bật TOTP, reset password không tự tắt MFA: lần đăng nhập kế tiếp vẫn yêu cầu TOTP. Người không còn thiết bị MFA dùng recovery do quản trị viên hỗ trợ, tránh biến OTP email thành bypass MFA.

### 4. Chính sách email không gửi được và chống enumeration

Email hợp lệ theo cú pháp chưa chứng minh mailbox nhận được. Kế hoạch áp dụng hai tầng:

1. Chặn trước các domain rõ ràng không phân phối được cho reset (`.local`, `.localhost`, `.test`, `.invalid`, demo/reserved domain được cấu hình) với thông báo cần liên hệ quản trị viên.
2. Với domain còn lại, chỉ kết luận không gửi được khi SMTP trả lỗi vĩnh viễn; không dùng DNS/MX lookup như một bằng chứng mailbox tồn tại.

Yêu cầu nêu ví dụ `abc@local.com`; `local.com` là domain công khai về mặt kỹ thuật, không thể tự động coi mọi email ở đó là giả mà không tạo false positive. Trước khi triển khai cần chốt một trong hai policy:

- **Khuyến nghị:** chỉ chặn suffix/domain reserved rõ ràng và hiển thị lỗi gửi khi SMTP báo không giao được; email không tồn tại vẫn trả thông báo chung để hạn chế enumeration.
- **Nghiêm ngặt theo danh sách doanh nghiệp:** Admin/triển khai duy trì allowlist domain nhận reset; mọi domain ngoài danh sách, bao gồm `local.com` nếu không được khai báo, nhận thông báo liên hệ quản trị viên. Cách này thay đổi phạm vi sang quản trị domain allowlist.

**Quyết định bổ sung 30-09-2026:** UI báo rõ khi email không tồn tại trong danh sách người dùng và chỉ chuyển sang bước OTP khi email thuộc tài khoản `active` đã gửi mã thành công. Đây là disclosure có chủ đích theo yêu cầu nghiệp vụ.

### 5. Liên kết hệ thống, tài liệu và kiểm thử

| Liên kết | Kế hoạch xử lý |
| --- | --- |
| Data/migration | Thêm bảng SMTP singleton và OTP request, CHECK/index/TTL cleanup idempotent; không đụng dữ liệu user hiện hữu. |
| Server validation | Zod cho SMTP, email, OTP đúng 6 số, password policy/confirmation; transactions và constant-time verification. |
| Config/secret | Reuse `encryptSecret`/`decryptSecret`; SMTP password write-only, tuyệt đối không `.env.example` plaintext hay API response. |
| RBAC | SMTP GET/PUT/test chỉ Admin; reset request/confirm public nhưng rate-limited và challenge-bound. |
| UI/CTA | Tab SMTP là CTA thật có lưu/test; CTA Quên mật khẩu thay thông báo placeholder bằng flow thực tế, không giữ text mô tả hành vi cũ. |
| Security | Thêm reset-specific limits, expiry, attempt cap, resend cooldown, one-time use, session revocation; không nới login/MFA policy. SMTP host cần kiểm tra chống localhost/private-address SSRF theo cùng chuẩn provider hiện có; SMTP nội bộ cần quyết định allowlist hạ tầng. |
| Audit/reporting | Audit thay đổi/test SMTP dạng redacted; không log reset OTP. Chỉ ghi sự kiện reset thành công tối thiểu nếu policy audit cần, không lộ email/OTP hơn mức log hiện có. |
| Docs/tests | Cập nhật API, deployment, user guide, README/memory; test unit/API/browser theo checklist dưới đây. |

## Trình tự triển khai

1. **Chốt policy còn mở và dependency mailer.** Chọn policy domain `local.com`/allowlist, TTL OTP (đề xuất 10 phút), max attempts (đề xuất 5), resend cooldown (đề xuất 60 giây), và chính sách SMTP nội bộ. Thêm `nodemailer` cùng type, không tự gửi mail thật trong test mặc định.
2. **Xây persistence + SMTP config server-side.** Migration idempotent, repository/service mã hóa secret, Admin API save/read/test, validation và audit redacted. Thêm tab SMTP theo design system hiện hữu.
3. **Xây request/confirm OTP.** Service sinh/hash/so sánh OTP, signed cookie challenge, PostgreSQL locking và rate-limit scopes; gửi mail, invalidation/expiry/cleanup; cập nhật password/session atomically.
4. **Kết nối login UI.** Thay CTA placeholder bằng dialog/stepper, reuse password checklist, xử lý cooldown/error/success và accessibility/focus; không để OTP/password trong URL hoặc localStorage.
5. **Kiểm thử và tài liệu.** Chạy migration/typecheck/build; unit/API cho RBAC, secret redaction, syntax/domain policy, unconfigured SMTP, failed test send, resend/expiry/replay/wrong OTP/rate limit, session revocation và MFA giữ nguyên; browser smoke desktop/mobile cho SMTP và recovery. Cập nhật docs/memory theo kết quả thật.

## Tiêu chí nghiệm thu

- [x] Admin có thể kiểm tra kết nối, lưu và gửi email test SMTP Gmail/SMTP chuẩn; password SMTP không xuất hiện lại qua API/UI/log. Cần nghiệm thu với SMTP credential và email nhận thật.
- [ ] Email registered, active và gửi được nhận OTP 6 số; OTP hết hạn, chỉ dùng một lần và request mới vô hiệu request trước.
- [ ] OTP sai vượt ngưỡng hoặc request quá nhanh bị chặn; không thể brute-force/reset không có cookie challenge hợp lệ.
- [ ] OTP đúng đổi password theo policy, thu hồi session cũ và không tự vô hiệu MFA.
- [ ] Email không tồn tại/không active báo rõ và không chuyển sang bước OTP; email bị policy/gửi thất bại trả thông báo liên hệ Admin đúng quyết định đã chốt.
- [ ] Non-admin không đọc/sửa/test SMTP; API/UI không còn CTA/placeholder mô tả luồng không tồn tại.
- [ ] Typecheck/build và test API/browser có evidence; deployment docs nêu secret, egress SMTP, TLS và vận hành cleanup.

## Quyết định cần người dùng chốt

1. **Đã chốt:** Chỉ block domain reserved rõ ràng hoặc khi SMTP báo lỗi gửi; không tự chặn `local.com`.
2. **Đã chốt:** Chưa hỗ trợ SMTP nội bộ/private host; chỉ SMTP public/TLS ở phiên bản này.
3. **Đã chốt:** Reset password qua email không tắt/bypass TOTP.
