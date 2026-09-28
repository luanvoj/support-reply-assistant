# Hardening xác thực và import tri thức

## Mục tiêu

Khép các finding còn mở trong [Security Report 2026-09-28](../../SECURITY-REPORT-2026-09-28.md), ngoại trừ SEC-003. MFA của Admin vẫn là **tự nguyện** trong MVP theo quyết định đã chốt.

Ứng dụng phải giới hạn dò mật khẩu và OTP ở nhiều instance, không làm lộ tình trạng tài khoản, và không còn phụ thuộc `xlsx@0.18.5` để đọc/tạo file Excel.

## Phạm vi

- SEC-001: giới hạn login theo IP, identity chuẩn hóa và endpoint chung.
- SEC-002: giới hạn MFA login theo pending challenge, user và IP; hủy challenge sau ngưỡng sai.
- SEC-004: thay `xlsx` khỏi luồng đọc/tạo XLSX, giữ contract CSV/XLSX và validation hiện tại.
- Bổ sung regression test cho RBAC/session và việc không trả API key/secret.
- Không thay policy MFA optional cho Admin, role/permission hay password policy.

## Kế hoạch triển khai

1. **Tạo distributed limiter trên PostgreSQL.**
   - Bổ sung migration idempotent trong `scripts/migrate.ts` cho bảng `auth_rate_limit_buckets`: `scope`, key đã chuẩn hóa, thời điểm window, attempt count, `blocked_until`, `updated_at`; index `(scope, key)`.
   - Tạo `lib/security/rate-limit.ts`; kiểm tra/cập nhật bằng transaction + UPSERT atomically để request song song hay nhiều container không vượt quota.
   - Dùng IP, identity lower-case và global endpoint. Mặc định: 10 login/IP/15 phút, 5 login/identity/15 phút, 100 login/global/phút; vượt ngưỡng block 15 phút. Cấu hình sau khi có traffic thật.
   - Chỉ tin `x-forwarded-for`/`x-real-ip` khi reverse proxy được khai báo đáng tin; nếu chưa có, không tin header client tự gửi và dùng key `unknown` cùng global/identity limit.
   - Không lưu password, OTP, JWT, raw API key hoặc raw IP; nếu cần telemetry, chỉ lưu mã định danh HMAC/hash server-side.

2. **Tích hợp login và MFA challenge.**
   - `app/api/auth/login/route.ts`: check limiter trước database/bcrypt; failure tăng counter; login thành công reset counter. Sai password, user không tồn tại hoặc bị disable vẫn trả cùng thông điệp chung.
   - Khi bị block, trả `429` kèm `Retry-After`; không trả số lần đã thử hay trạng thái tài khoản.
   - `app/api/auth/mfa/verify/route.ts`: giới hạn theo fingerprint của pending JWT (không lưu raw token), user ID và IP. Tối đa 5 OTP sai/challenge, sau đó xóa pending cookie; thêm 10 attempt/IP/15 phút.
   - `lib/auth/session.ts`: bổ sung API xóa MFA pending cookie dùng cho expired/exhausted challenge, không thay session TTL 5 phút/8 giờ hiện tại.

3. **Thay parser/generator XLSX.**
   - Thay `xlsx@0.18.5` bằng thư viện còn duy trì (ưu tiên đánh giá `exceljs` với Node 22 và license phù hợp), sau đó xóa `xlsx` khỏi `package.json`/lockfile.
   - Tách `lib/knowledge/import.ts` thành adapter CSV/XLSX và template generator; duy trì contract parse/template của route hiện tại.
   - Trước parse: giới hạn 5 MB, chỉ worksheet đầu, tối đa 200 rows, từ chối workbook rỗng/encrypted/malformed; giữ validation cột, độ dài cell, markdown text-only và policy hiện có.
   - Cập nhật import, preview, template route và `scripts/knowledge-import-smoke.ts`. Không đưa formula hoặc workbook metadata vào database/API response.

4. **Test, vận hành và tài liệu.**
   - Test rate-limit: đổi IP/identity, request song song, reset khi login đúng, 429/`Retry-After`, cleanup bucket, không lộ secret trong telemetry.
   - Test MFA: 5 lần sai hủy challenge; OTP đúng trước ngưỡng tạo session; JWT pending hết hạn và session version cũ bị từ chối.
   - Test RBAC: JWT giả mạo/sửa role, user disabled, session phiên cũ; provider GET không trả encrypted/plain API key.
   - Test CSV/XLSX: file hợp lệ, sai cột, malformed, rỗng, quá 200 rows, cell quá dài; chạy cả preview và import.
   - Cập nhật `docs/API.md`, `docs/DEPLOYMENT.md`, README và security report. Nêu rõ app limiter không thay thế WAF/edge rate limit, và database cần cleanup bucket hết hạn.

5. **Xác minh trước khi đóng finding.**
   - Chạy migration, `npm run typecheck`, test mới, `npm audit --omit=dev`, Docker build và authenticated API/browser smoke test.
   - Xác minh limiter còn hiệu lực sau restart hoặc với tối thiểu hai instance cùng database.
   - Chỉ đổi SEC-001/002/004 từ `OPEN` sang `VERIFIED` khi có evidence runtime; Admin MFA vẫn ghi `NOT-APPLICABLE (MVP policy)` cho remediation này.

## File dự kiến thay đổi

- `scripts/migrate.ts`, `lib/security/rate-limit.ts` (mới)
- `app/api/auth/login/route.ts`, `app/api/auth/mfa/verify/route.ts`, `lib/auth/session.ts`
- `lib/knowledge/import.ts`, các route import/preview/template, `scripts/knowledge-import-smoke.ts`
- `package.json`, `package-lock.json`, test files mới
- `docs/API.md`, `docs/DEPLOYMENT.md`, README, security report và memory index

## Tiêu chí nghiệm thu

- [ ] Login bị giới hạn theo IP, identity và endpoint; không enumeration account.
- [ ] 429 có `Retry-After`; giới hạn giữ được qua nhiều instance/restart.
- [ ] MFA login không thể vượt quá 5 lần OTP sai trong một challenge.
- [ ] MFA Admin vẫn optional trong MVP.
- [ ] JWT giả/sửa role, user disabled và session cũ không qua guard; API provider không lộ key.
- [ ] CSV/XLSX hợp lệ vẫn import được; malformed/oversized/quá quota bị từ chối.
- [ ] Production dependency tree không còn advisory `xlsx`; typecheck, tests, Docker build và smoke test PASS.

## Rủi ro/điều kiện

- IP limiter chỉ chính xác nếu proxy strip/ghi đè header forwarding. Cần chốt contract proxy trước production.
- Ngưỡng mặc định có thể ảnh hưởng user chung NAT; kết hợp identity limit và theo dõi số hit để điều chỉnh.
- Chỉ thay `xlsx` sau khi thư viện mới đã chứng minh đọc/ghi đúng fixture hiện có và phù hợp license.

## Cập nhật triển khai — 2026-09-28

- Hoàn thành migration `auth_rate_limit_buckets`, limiter PostgreSQL, cleanup command, login/MFA integration, `TRUST_PROXY` contract và tài liệu vận hành.
- Hoàn thành thay `xlsx` bằng `exceljs@4.4.0`, override `uuid@11.1.1`, template/import/preview adapter và XLSX smoke script.
- PASS: `npm run typecheck`, `npm run db:migrate`, `npm run knowledge:import-smoke`, MFA limiter threshold smoke, `npm audit --omit=dev --json`, `npm run build`.
- NOT-RUN: browser/API end-to-end login/MFA throttle với session thật, test hai web instance và production proxy/WAF contract.
