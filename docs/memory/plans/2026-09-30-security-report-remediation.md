# Khắc phục findings từ Security Report 2026-09-30

> Nguồn: `docs/SECURITY-REPORT-2026-09-30.md`. Phạm vi: password-reset OTP và SMTP. Trạng thái: **đã triển khai trong workspace — chờ retest runtime/production**.

## Kết quả mong đợi

- Đóng hai finding Medium: **SEC-007** (spam/DoS gửi OTP) và **SEC-008** (OTP cũ còn hợp lệ khi xin mã mới).
- Hoàn thiện vận hành dữ liệu OTP của **SEC-010**; giảm bề mặt SSRF/DNS rebinding của SMTP theo **SEC-011** mà vẫn hỗ trợ SMTP public/TLS.
- Giữ nguyên quyết định nghiệp vụ đã chấp nhận tại **SEC-009**: UI/API báo rõ email không tồn tại; rate limit mới là lớp giảm thiểu bắt buộc cho disclosure này.
- Không làm lộ OTP, password SMTP, email nhận test hay thay đổi cơ chế MFA/session hiện hữu.

## Hiện trạng đã đối chiếu

- `requestPasswordReset(identity)` hiện chỉ ghi bucket `password-reset:identity` (3/15 phút), không có bucket global/IP. `requestClientKey()` đã có đúng contract `string | null`: chỉ tin forwarded header khi `TRUST_PROXY=true`.
- Route reset tạo từng dòng `password_reset_requests` độc lập; một mã trước đó có thể còn `consumed_at IS NULL`.
- Có index expiry nhưng chưa có script/cron retention cho `password_reset_requests`.
- `unsafeHost()` chỉ lọc hostname/IP bằng chuỗi. Cả API lưu/test và `lib/mailer.ts` chưa pin địa chỉ DNS đã kiểm tra trước lúc mở kết nối.

## Impact map

| Liên kết | Cách xử lý |
| --- | --- |
| Data & migration | Không cần đổi schema cho SEC-007/008. Giữ index expiry; thêm script xóa bản ghi reset hết hạn/đã dùng quá 30 ngày cho SEC-010. |
| API/server validation | `POST /api/auth/password-reset/request` dùng helper limit mới trước tra user/gửi mail; tạo yêu cầu mới và invalidate yêu cầu cũ trong cùng transaction. SMTP validate hostname ở API **và** lúc mailer gửi. |
| Configuration & infrastructure | Chỉ dùng IP client khi `TRUST_PROXY=true`; deployment phải có reverse-proxy/WAF strip và ghi lại forwarding headers. Retention phải được scheduler gọi với `--apply`. |
| RBAC/session | Reset vẫn public, SMTP vẫn Admin-only. Reset thành công vẫn tăng `session_version`; MFA/TOTP không bị tắt hay bypass. |
| UI/CTA & trạng thái | Không đổi luồng email → OTP; 429 giữ `Retry-After` và thông báo hiện hữu. SMTP UI hiển thị lỗi hostname không an toàn theo thông điệp không lộ DNS/IP nội bộ. |
| Audit/reporting | Không log OTP/email recipient/SMTP secret. Có thể ghi metric aggregate theo scope rate-limit; không biến bucket hash thành dữ liệu PII trong log. |
| Docs/tests | Cập nhật API/DEPLOYMENT cho limit reset, proxy contract, job retention và SMTP public-only; cập nhật report finding theo evidence sau retest. |

## Kế hoạch triển khai

1. **Đóng SEC-007 bằng limit đa tầng.** Trong `lib/security/rate-limit.ts`, thêm `password-reset:global` (đề xuất 60/phút), `password-reset:ip` (đề xuất 10/15 phút, chỉ khi có `requestClientKey`) và helper `checkPasswordResetRequest(request, identity)`. Helper kiểm tra bucket bị khóa trước, sau đó ghi nhận global/IP/identity cho mọi request hợp lệ về cú pháp, kể cả email không tồn tại, để bảo vệ SEC-009. Thay caller trong `app/api/auth/password-reset/request/route.ts`, giữ `429` và `Retry-After`. Không tái dùng key `unknown`, không tin `X-Forwarded-For` ở direct deployment.

2. **Đóng SEC-008 bằng một active reset duy nhất.** Chuyển phần tạo request sang `withTransaction`: khóa các request chưa dùng của `user_id`, đặt `consumed_at=now()` cho chúng, rồi insert request mới và lưu hash OTP. Transaction phải hoàn tất trước khi gửi mail/challenge cookie; khi gửi mail lỗi, request mới không được đưa vào luồng confirm (và mã cũ vẫn đã bị vô hiệu hóa theo invariant bảo mật). Route confirm vẫn khóa `FOR UPDATE`, cap 5 attempts, expiry và one-time consume. Rà resend/UI để không tồn tại CTA hay message ngụ ý nhiều mã có thể dùng song song.

3. **Đóng SEC-010 bằng retention có thể vận hành.** Tạo `scripts/password-reset-retention.ts` theo pattern dry-run/`--apply` của auth-rate-limit retention. Chỉ xóa request hết hạn hoặc đã consumed sau thời hạn lưu 30 ngày; in số lượng, không in email/OTP. Thêm `password-resets:retention` vào `package.json`, lịch chạy hằng ngày và hướng dẫn scheduler trong `docs/DEPLOYMENT.md`. Không xóa trực tiếp bằng migration/release vì retention là thao tác vận hành định kỳ.

4. **Defense-in-depth SEC-011: resolve, chặn và pin endpoint SMTP.** Tách guard server-only dùng cho `PUT /api/settings/smtp`, `/test`, `/send-test` và `lib/mailer.ts`: chuẩn hóa hostname, resolve A/AAAA, từ chối toàn bộ IP loopback, private, link-local, multicast, unspecified và metadata-reserved IPv4/IPv6. Transport phải kết nối tới IP đã validate/pin thay vì để resolver gọi lại hostname (tránh TOCTOU/DNS rebinding), đồng thời giữ TLS `servername` là hostname gốc để certificate validation hoạt động. Runtime mailer cũng bắt buộc guard này để cấu hình cũ trong DB không bypass validation. Chuẩn hóa mã lỗi không lộ địa chỉ resolve; giữ chính sách không hỗ trợ SMTP nội bộ.

5. **Retest và cập nhật evidence.** Thêm test/API smoke cho: global 60/phút, IP độc lập khi proxy trusted, header giả mạo bị bỏ qua khi untrusted, identity 3/15 phút và `Retry-After`; xin mã thứ hai làm OTP/challenge thứ nhất fail; concurrent reset chỉ còn một record active; retention dry-run/apply; hostname public hợp lệ, DNS trả private/IPv6 loopback và DNS đổi kết quả đều bị chặn. Chạy migration (idempotent), typecheck, build, `npm audit`; xác minh scheduler/`TRUST_PROXY` trên môi trường deploy trước khi đóng findings.

## Rủi ro và quyết định còn mở

- **Ngưỡng global 60/phút, IP 10/15 phút** là đề xuất của audit; cần đo traffic thật sau rollout. Có thể gây 429 cho nhiều người dùng chung NAT; không tự tăng/giảm ngưỡng nếu chưa có số liệu vận hành.
- Khi SMTP gửi thất bại sau khi transaction reset đã tạo mã mới, mã cũ vẫn bị invalid theo yêu cầu bảo mật; UI cho phép người dùng yêu cầu lại sau cooldown. Không rollback mã cũ vì có thể tạo replay/race.
- Pin DNS với STARTTLS/SMTPS cần test thực tế với Gmail và một SMTP public khác, đặc biệt certificate/SNI. Không mở allowlist SMTP nội bộ; nếu có nhu cầu mới, cần thiết kế network allowlist riêng.
- SEC-009 vẫn là accepted business policy, không phải finding để sửa. Việc đóng SEC-007 là điều kiện giảm thiểu bắt buộc để chấp nhận rủi ro này.

## Tiêu chí nghiệm thu

- [x] Source đã giới hạn reset theo global/IP/identity; direct deployment không dùng IP header do client tự gửi. Chờ retest threshold/runtime.
- [x] Source tạo request mới trong transaction và invalidate request cũ; chờ concurrent/resend retest.
- [x] Có script retention dry-run/`--apply` và hướng dẫn scheduler; scheduler môi trường chưa xác minh.
- [x] Source resolve/chặn/pin endpoint SMTP ở save/test/send runtime; chờ SMTP public thật và DNS rebinding retest.
- [ ] Typecheck/build/audit và test matrix đạt; docs/API/deployment/security report phản ánh đúng trạng thái, các finding chỉ chuyển Fixed sau evidence môi trường thật.
