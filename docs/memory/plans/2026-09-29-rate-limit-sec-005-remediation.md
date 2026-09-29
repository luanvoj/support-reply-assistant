# Khắc phục SEC-005: Rate limit IP `unknown` gây từ chối dịch vụ đăng nhập

> Nguồn: `docs/SECURITY-REPORT-2026-09-29.md`, finding **SEC-005** (High). Trạng thái: source fix đã triển khai 29/09/2026; cấu hình proxy production còn cần xác minh khi deploy.

## Kết quả mong đợi

- Một request không xác định được IP client không bao giờ dùng bucket chung `login:ip` hoặc `mfa:ip` với key `unknown`.
- Đăng nhập/MFA vẫn được bảo vệ ở mọi topology: limit global, limit theo identity/challenge; thêm limit theo IP chỉ khi proxy đáng tin cậy đã cung cấp IP hợp lệ.
- Không cho phép client tự giả mạo IP qua `X-Forwarded-For` khi `TRUST_PROXY` không được bật theo hợp đồng hạ tầng.

## Hiện trạng đã xác minh

- `requestClientKey()` trả literal `"unknown"` khi `TRUST_PROXY !== "true"`; `checkLoginRequest`, `recordLoginFailure`, `checkMfaRequest` và `recordMfaFailure` đều đưa giá trị đó vào các bucket IP.
- Chỉ 10 yêu cầu lỗi có thể khóa `login:ip/unknown` trong 900 giây, chặn mọi request login/MFA kế tiếp trước khi kiểm tra credential. Đây đúng chuỗi khai thác của SEC-005.
- PostgreSQL là nơi lưu `auth_rate_limit_buckets`, nên counter đã chia sẻ giữa nhiều instance. `DEPLOYMENT.md` chỉ cho phép `TRUST_PROXY=true` khi proxy strips/re-writes forwarding header.

## Impact map

| Liên kết | Xử lý |
| --- | --- |
| Runtime/auth | Chuyển biểu diễn IP không xác định từ string sentinel sang `null`/optional; hàm tạo danh sách limit chỉ thêm `loginIp`/`mfaIp` khi có IP hợp lệ. |
| Persistence | Không migration. Bucket hash `unknown` cũ tự hết hạn theo job retention; không cần đọc/xóa trực tiếp lúc release. |
| RBAC/session | Không đổi authentication response generic, session, MFA challenge hay `Retry-After`; các limit identity/challenge vẫn bảo vệ brute force. |
| Infrastructure | Default không trust forwarded headers. Production chỉ bật `TRUST_PROXY=true` sau khi reverse proxy/WAF đã được kiểm chứng strip và ghi lại headers. Duy trì edge/WAF limit độc lập. |
| Observability | Không ghi identity/IP thô vào log. Ghi/đếm event limit hit bằng scope đã hash hoặc metric aggregate nếu observability hiện có; rate-limit không được mở thành nguồn PII. |
| Docs/tests | Cập nhật API/deployment/security report và smoke matrix cho trusted/untrusted proxy, login/MFA, retry/reset và multi-instance DB. |

## Kế hoạch triển khai

1. Refactor `lib/security/rate-limit.ts` để `requestClientKey()` trả `string | null`: chỉ đọc header khi `TRUST_PROXY === "true"`, validate/normalize giá trị đầu tiên thành IP hợp lệ, còn thiếu/sai trả `null`. Không dùng fallback `"unknown"` làm key limit.
2. Tạo helper xây danh sách limit để `checkLoginRequest` luôn kiểm tra/ghi `loginGlobal` và `loginIdentity`, nhưng chỉ check/record/clear `loginIp` khi có client key; áp dụng cùng nguyên tắc cho `mfaIp` bên cạnh `mfaChallenge`. Giữ nguyên threshold, window, `429`, `Retry-After` và phản hồi không tiết lộ credential.
3. Rà endpoint caller `POST /api/auth/login` và `POST /api/auth/mfa/verify`: xác nhận nhánh rate-limited vẫn revoke MFA pending session theo chính sách hiện tại và login success chỉ xóa đúng bucket có tồn tại; không thay session version hoặc audit nội dung nhạy cảm.
4. Cập nhật `.env.example`/`docs/DEPLOYMENT.md` và `docs/API.md`: default direct deployment không có IP limit ứng dụng; cần edge rate limit, và chỉ cấu hình `TRUST_PROXY=true` khi có proxy contract kiểm chứng. Đánh dấu SEC-005 là fixed only after source + production configuration evidence.
5. Kiểm chứng: test/smoke DB cho 10 lỗi trong `TRUST_PROXY=false` không khóa identity khác; cùng test khi proxy trusted với hai IP khác nhau (bucket độc lập), cùng identity bị limit 5/15 phút, MFA challenge limit 5/5 phút, header forged bị bỏ qua khi untrusted, `Retry-After` đúng, success reset đúng scope. Chạy typecheck/build và test nhiều instance dùng cùng PostgreSQL.

## Quyết định và rủi ro

- Không suy diễn `X-Forwarded-For` ở direct deployment: ưu tiên bỏ IP limit hơn tin header do attacker cung cấp. Global + identity/challenge limit giữ phòng vệ application-level; edge/WAF đảm nhận protection theo IP trước khi request vào app.
- `loginGlobal` hiện là bucket dùng chung 100 request/60 giây. Theo remediation tối thiểu của report nó được giữ nguyên, nhưng cần đo traffic thực tế và đặt edge throttling để tránh nó thành điểm nghẽn thứ hai ở tải cao.
- Không đổi số lần thử trong task này. Bất kỳ điều chỉnh threshold/lockout hoặc account lock vĩnh viễn là quyết định sản phẩm riêng vì có thể ảnh hưởng người dùng hợp lệ.
