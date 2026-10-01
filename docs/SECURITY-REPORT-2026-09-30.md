# Báo cáo kiểm định bảo mật (Security Audit Report) — 2026-09-30
## Đánh giá chuyên sâu: Chức năng Quên mật khẩu qua Email OTP & Cấu hình SMTP

---

## 1. Phạm vi & Snapshot kiểm tra

- **Dự án**: `support-reply-assistant`
- **Thời điểm thực hiện**: 2026-09-30
- **Phạm vi kiểm tra**:
  - Chức năng Quên mật khẩu qua email OTP vừa triển khai:
    - `app/api/auth/password-reset/request/route.ts`
    - `app/api/auth/password-reset/confirm/route.ts`
    - `lib/auth/password-reset.ts`
    - `lib/mailer.ts`
    - `lib/security/rate-limit.ts`
    - `app/login/page.tsx`
  - Quản trị cấu hình SMTP và kiểm tra kết nối:
    - `app/api/settings/smtp/route.ts`
    - `app/api/settings/smtp/test/route.ts`
    - `app/api/settings/smtp/send-test/route.ts`
    - `components/screens/settings-screen.tsx`
  - Cấu trúc lưu trữ dữ liệu & Di chuyển cơ sở dữ liệu:
    - Bảng `smtp_settings`, `password_reset_requests` trong `scripts/migrate.ts`.
  - Phụ thuộc bên thứ ba liên quan:
    - Thư viện gửi email `nodemailer` và kiểm tra lỗ hổng qua `npm audit --json`.
- **Kế hoạch & Đặc tả tham chiếu**:
  - `docs/memory/plans/2026-09-30-smtp-otp-password-recovery.md`
  - Báo cáo kiểm định gần nhất: `docs/SECURITY-REPORT-2026-09-29.md`

---

## 2. Tóm tắt kết quả (Executive Summary)

Chức năng **Quên mật khẩu qua email OTP** và **Cấu hình SMTP** đã được thiết kế và triển khai với nhiều lớp bảo vệ tiêu chuẩn cao:
- **Bảo vệ thông tin bí mật (Secrets Protection)**: **ĐẠT (PASS)**. Mật khẩu SMTP được mã hóa bằng AES-256-GCM trước khi lưu trữ, API `GET /api/settings/smtp` không bao giờ trả về mật khẩu (chỉ trả cờ `configured: true/false`). Nhật ký vận hành (Operational Logs) được làm sạch triệt để, không chứa mật khẩu SMTP và ẩn địa chỉ email nhận test.
- **Bảo mật mã OTP & Cơ chế chống Brute-Force**: **ĐẠT (PASS)**. Mã OTP 6 chữ số được tạo bằng bộ sinh số giả ngẫu nhiên mật mã an toàn (CSPRNG `crypto.randomInt`), được băm bằng HMAC-SHA256 kết hợp `requestId` và `AUTH_SECRET` trước khi lưu vào DB (không lưu OTP dạng văn bản thuần). Quá trình đối soát sử dụng `timingSafeEqual` chống tấn công đo thời gian (Timing Attack). Cơ chế khóa hàng `FOR UPDATE` trong transaction triệt tiêu race condition, và áp dụng giới hạn cứng tối đa 5 lần thử sai cho mỗi mã.
- **Quản lý phiên làm việc & Xác thực 2 bước (Session & MFA)**: **ĐẠT (PASS)**. Đổi mật khẩu thành công ngay lập tức tăng `session_version`, thu hồi toàn bộ phiên đăng nhập đang hoạt động trên các thiết bị. Hệ thống không tự ý tắt hoặc bỏ qua MFA (TOTP); người dùng bật 2FA vẫn phải xác thực OTP ứng dụng khi đăng nhập lại.
- **Phụ thuộc bên thứ ba**: **ĐẠT (PASS)**. Kết quả `npm audit` ghi nhận **0 lỗ hổng** trên toàn bộ 249 dependencies.
- **Các điểm cần xử lý**: Phát hiện **2 vấn đề mức độ Trung bình (Medium)** cần bổ sung kiểm soát:
  1. *SEC-007 (Medium)*: Thiếu giới hạn tần suất theo địa chỉ IP và toàn cục tại API yêu cầu gửi mã OTP (`/api/auth/password-reset/request`), dẫn tới nguy cơ bị kẻ tấn công lạm dụng để spam gửi email hàng loạt và làm cạn kiệt quota SMTP.
  2. *SEC-008 (Medium)*: Chưa tự động vô hiệu hóa (invalidate) các mã OTP đang chờ xử lý trước đó của cùng một tài khoản khi người dùng yêu cầu mã mới, vi phạm bất biến kiến trúc đã đề ra trong kế hoạch.

---

## 3. Bảng tổng hợp các phát hiện (Findings Summary)

| Mã định danh | Mức độ | Nhóm tấn công | Tên vấn đề | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-007** | **Medium** | Lạm dụng tính năng & DoS | Thiếu Rate Limiting theo IP và Global tại endpoint yêu cầu đặt lại mật khẩu | **MỞ (OPEN)** |
| **SEC-008** | **Medium** | Logic nghiệp vụ & Token Replay | Không vô hiệu hóa các mã OTP trước đó khi người dùng yêu cầu mã mới | **MỞ (OPEN)** |
| **SEC-009** | **Low** | Rò rỉ dữ liệu (Information Disclosure) | Lộ diện tài khoản tồn tại (User Enumeration Oracle) qua phản hồi API | **CHẤP NHẬN (ACCEPTED BUSINESS POLICY)** |
| **SEC-010** | **Low** | Vận hành & Tối thiểu hóa dữ liệu | Thiếu cơ chế dọn dẹp định kỳ (Purge Cleanup) cho bảng `password_reset_requests` | **MỞ (OPEN)** |
| **SEC-011** | **Low** | Cấu hình mạng & SSRF | Hàm kiểm tra hostname SMTP chưa phòng chống DNS Rebinding trỏ về mạng nội bộ | **KHUYẾN NGHỊ (DEFENSE-IN-DEPTH)** |

---

## 4. Chi tiết các phát hiện & Đề xuất khắc phục

### SEC-007 — Thiếu Rate Limiting theo IP và Global tại endpoint yêu cầu đặt lại mật khẩu

- **Mức độ nghiêm trọng**: **Medium**
- **Trạng thái**: **MỞ (OPEN)**
- **Độ tin cậy**: **High**
- **Vị trí mã nguồn**: 
  - `lib/security/rate-limit.ts:14, 74`
  - `app/api/auth/password-reset/request/route.ts:16-17`
- **Chuỗi bằng chứng & Khả năng khai thác**:
  1. *Tác nhân*: Kẻ tấn công chưa xác thực từ Internet (Unauthenticated attacker).
  2. *Thao tác kích hoạt*: Sử dụng công cụ tự động gửi hàng loạt HTTP POST tới `/api/auth/password-reset/request` với danh sách hàng trăm hoặc hàng nghìn địa chỉ email nhân viên công ty từ cùng một địa chỉ IP.
  3. *Cơ chế kiểm soát hiện tại*: Route chỉ gọi:
     ```typescript
     const limit = await requestPasswordReset(email);
     ```
     Trong `lib/security/rate-limit.ts`:
     ```typescript
     const passwordResetIdentity = (identity: string): Limit => ({
       scope: "password-reset:identity",
       key: identity,
       maxAttempts: 3,
       windowSeconds: 900,
       blockSeconds: 900,
     });
     export async function requestPasswordReset(identity: string) {
       return record(passwordResetIdentity(normalizedIdentity(identity)));
     }
     ```
     Cơ chế này **chỉ giới hạn 3 lần/15 phút trên mỗi địa chỉ email đơn lẻ**, hoàn toàn không kiểm tra địa chỉ IP của client (`requestClientKey(request)`) và không có giới hạn toàn cục (`global bucket`).
  4. *Hậu quả thực tế quan sát được*:
     - Kẻ tấn công có thể spam gửi email chứa mã OTP đến toàn bộ nhân viên trong công ty mà không bị chặn IP.
     - Làm cạn kiệt hạn ngạch gửi thư của dịch vụ SMTP (ví dụ: Google Workspace giới hạn 500–2.000 email/ngày; AWS SES giới hạn gửi theo gói).
     - Nguy cơ địa chỉ IP / domain gửi thư của công ty bị các nhà cung cấp dịch vụ email (Gmail, Microsoft 365) đưa vào danh sách đen (Blacklist/Spam score cao) do gửi thư dồn dập không bình thường.
- **Đề xuất khắc phục nhỏ nhất, hiệu quả nhất (Smallest Effective Source Fix)**:
  - Bổ sung `passwordResetGlobal` (ví dụ: tối đa 60 yêu cầu/phút) và `passwordResetIp` (ví dụ: tối đa 10 yêu cầu/15 phút khi `TRUST_PROXY === "true"`):
  - Cập nhật hàm `checkPasswordResetRequest(request: Request, identity: string)` trong `lib/security/rate-limit.ts` theo cấu trúc tương tự `checkLoginRequest`:
    ```typescript
    const passwordResetGlobal: Limit = { scope: "password-reset:global", key: "global", maxAttempts: 60, windowSeconds: 60, blockSeconds: 60 };
    const passwordResetIp = (ip: string): Limit => ({ scope: "password-reset:ip", key: ip, maxAttempts: 10, windowSeconds: 900, blockSeconds: 900 });

    export async function checkPasswordResetRequest(request: Request, identity: string) {
      const clientKey = requestClientKey(request);
      const limits = [passwordResetGlobal, ...(clientKey ? [passwordResetIp(clientKey)] : []), passwordResetIdentity(normalizedIdentity(identity))];
      for (const limit of limits) {
        const status = await isBlocked(limit);
        if (!status.allowed) return status;
      }
      return record(passwordResetIdentity(normalizedIdentity(identity)));
    }
    ```

---

### SEC-008 — Không vô hiệu hóa các mã OTP trước đó khi người dùng yêu cầu mã mới

- **Mức độ nghiêm trọng**: **Medium**
- **Trạng thái**: **MỞ (OPEN)**
- **Độ tin cậy**: **High**
- **Vị trí mã nguồn**: `app/api/auth/password-reset/request/route.ts:21-27`
- **Chuỗi bằng chứng & Khả năng khai thác**:
  1. *Tác nhân*: Người dùng gửi yêu cầu đặt lại mật khẩu nhiều lần liên tiếp (hoặc kẻ tấn công kích hoạt gửi mã liên tục).
  2. *Thao tác kích hoạt*: Nhấp nút "Gửi mã xác thực" ở phút thứ 1 (sinh OTP 1). Sau đó nhấp "Gửi lại mã" ở phút thứ 3 (sinh OTP 2).
  3. *Cơ chế kiểm soát hiện tại*:
     ```typescript
     const created = await query<{ id: string }>(
       `INSERT INTO password_reset_requests(user_id,email,otp_hash,expires_at) VALUES($1,$2,'pending',now()+make_interval(secs=>$3::int)) RETURNING id`,
       [user.rows[0].id, email, RESET_TTL_SECONDS]
     );
     ```
     Hệ thống chỉ chèn thêm một dòng mới vào bảng `password_reset_requests`. Dòng dữ liệu của OTP 1 vẫn giữ trạng thái `consumed_at IS NULL` và `expires_at > now()`.
  4. *Độ lệch so với tài liệu kiến trúc*:
     Tài liệu `docs/memory/plans/2026-09-30-smtp-otp-password-recovery.md` dòng 37 và dòng 86 quy định rõ:
     > *"chỉ một yêu cầu đang hiệu lực cho một user, request mới sẽ vô hiệu request cũ."*
  5. *Hậu quả thực tế*:
     Mặc dù trình duyệt hiện tại bị ghi đè cookie JWT challenge trỏ tới `requestId` mới, nhưng trên cơ sở dữ liệu, **cả OTP 1 và OTP 2 đều đồng thời hợp lệ** trong thời gian 10 phút. Nếu một kẻ tấn công hoặc bên thứ ba chặn bắt được OTP 1 (hoặc email đến chậm và người dùng giữ cookie phiên cũ), họ vẫn có thể sử dụng OTP 1 để đặt lại mật khẩu thành công.
- **Đề xuất khắc phục nhỏ nhất, hiệu quả nhất (Smallest Effective Source Fix)**:
  - Trong transaction tạo yêu cầu mới tại `app/api/auth/password-reset/request/route.ts`, thực hiện vô hiệu hóa toàn bộ yêu cầu chưa dùng trước đó của `user_id`:
    ```typescript
    await query(
      "UPDATE password_reset_requests SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL",
      [user.rows[0].id]
    );
    ```

---

### SEC-009 — Lộ diện tài khoản tồn tại (User Enumeration Oracle) qua phản hồi API

- **Mức độ nghiêm trọng**: **Low**
- **Trạng thái**: **ACCEPTED (Quyết định nghiệp vụ đã chốt ngày 2026-09-30)**
- **Độ tin cậy**: **High**
- **Vị trí mã nguồn**: `app/api/auth/password-reset/request/route.ts:18-20`
- **Mô tả chi tiết**:
  - API trả về HTTP 404 với thông báo `"Email không tồn tại trong danh sách người dùng hoặc tài khoản không còn hoạt động."` nếu email không có trong DB.
  - API trả về HTTP 200 kèm `"Mã xác thực đã được gửi đến email của bạn."` nếu email hợp lệ và đang hoạt động.
  - Sự khác biệt về mã trạng thái HTTP (404 vs 200) và nội dung thông báo cho phép kẻ bên ngoài biết chính xác địa chỉ email nào có tài khoản đang kích hoạt trong hệ thống hỗ trợ.
- **Đánh giá nghiệp vụ & Giảm thiểu**:
  - Theo tài liệu `docs/memory/plans/2026-09-30-smtp-otp-password-recovery.md` (mục 4, dòng 60):
    > *"Quyết định bổ sung 30-09-2026: UI báo rõ khi email không tồn tại trong danh sách người dùng và chỉ chuyển sang bước OTP khi email thuộc tài khoản active đã gửi mã thành công. Đây là disclosure có chủ đích theo yêu cầu nghiệp vụ."*
  - Do đây là quyết định chủ đích về UX của sản phẩm nội bộ, rủi ro được chấp nhận có kiểm soát.
  - Tuy nhiên, để ngăn chặn việc quét tự động quy mô lớn danh bạ email nhân sự, **bắt buộc phải triển khai khắc phục SEC-007** (giới hạn tần suất theo IP).

---

### SEC-010 — Bảng `password_reset_requests` chưa có cơ chế dọn dẹp định kỳ (Retention Cleanup)

- **Mức độ nghiêm trọng**: **Low** (Phòng thủ theo chiều sâu & Vận hành)
- **Trạng thái**: **MỞ (OPEN)**
- **Độ tin cậy**: **High**
- **Vị trí mã nguồn**: `scripts/migrate.ts:315-321`
- **Mô tả chi tiết**:
  - Bảng `password_reset_requests` đã được tạo chỉ mục `password_reset_requests_expiry_idx ON password_reset_requests(expires_at)`.
  - Tuy nhiên, trong thư mục `scripts/` hiện mới chỉ có các kịch bản dọn dẹp dữ liệu hội thoại (`retention.ts`), nhật ký vận hành (`operational-log-retention.ts`), và rate limit (`auth-rate-limit-retention.ts`).
  - Chưa có cron job hoặc script bảo trì để xóa định kỳ các bản ghi OTP đã hết hạn hoặc đã tiêu thụ quá 30 ngày. Về lâu dài, các bản ghi này sẽ tích lũy trong database.
- **Đề xuất khắc phục**:
  - Bổ sung lệnh xóa các yêu cầu đặt lại mật khẩu cũ hơn 30 ngày vào script dọn dẹp định kỳ:
    ```sql
    DELETE FROM password_reset_requests WHERE expires_at < now() - interval '30 days';
    ```

---

### SEC-011 — Hàm kiểm tra hostname SMTP chưa phòng chống DNS Rebinding trỏ về mạng nội bộ

- **Mức độ nghiêm trọng**: **Low** (Phòng thủ theo chiều sâu)
- **Trạng thái**: **KHUYẾN NGHỊ (DEFENSE-IN-DEPTH)**
- **Độ tin cậy**: **Medium**
- **Vị trí mã nguồn**: `app/api/settings/smtp/route.ts:11`, `app/api/settings/smtp/test/route.ts:9`
- **Mô tả chi tiết**:
  - Hàm `unsafeHost(host)` hiện tại kiểm tra chuỗi ký tự:
    ```typescript
    function unsafeHost(host: string) {
      const lower = host.toLowerCase();
      return lower === "smtp.google.com" || isIP(lower) || lower === "localhost" ||
             lower.endsWith(".local") || lower.endsWith(".localhost") ||
             lower.endsWith(".test") || lower.endsWith(".invalid");
    }
    ```
  - Nếu một Quản trị viên nhập vào một tên miền công khai hợp lệ (ví dụ: `smtp.internal-rebind.net`) nhưng bản ghi DNS A/AAAA của tên miền đó trỏ về địa chỉ IP mạng nội bộ (như `127.0.0.1`, `10.x.x.x`, `192.168.x.x` hoặc `169.254.169.254` AWS Metadata), thư viện `nodemailer` sẽ phân giải tên miền và gửi gói tin kết nối TCP tới IP nội bộ đó.
  - **Yếu tố giảm thiểu**: Endpoint này yêu cầu quyền `admin` (`requireRole("admin")`). Tác nhân ở đây là Quản trị viên hệ thống nên không vượt qua ranh giới tin cậy từ bên ngoài.
- **Khuyến nghị**: Để phòng thủ theo chiều sâu, có thể bổ sung bước phân giải `dns.promises.lookup` trước khi kết nối và xác minh địa chỉ IP trả về không thuộc dải private/loopback.

---

## 5. Đánh giá các khía cạnh an toàn đã được chứng minh

1. **Không rò rỉ mã OTP hoặc Mật khẩu ra ngoài**:
   - OTP gửi qua email dạng văn bản thuần, không kèm link reset nhạy cảm.
   - Database chỉ lưu HMAC-SHA256 của `${requestId}:${otp}`, kẻ xâm nhập cơ sở dữ liệu không thể phục hồi mã OTP gốc.
   - Thử nghiệm gửi mail test (`POST /api/settings/smtp/send-test`) chỉ ghi nhật ký thao tác với `details: {}`, không ghi lại địa chỉ email người nhận.
2. **Không vượt quyền / Bypass MFA**:
   - Đặt lại mật khẩu thành công không tự ý vô hiệu hóa MFA. Lần đăng nhập tiếp theo với mật khẩu mới vẫn bắt buộc nhập TOTP 6 số nếu tài khoản đã cấu hình 2FA.
   - Mật khẩu mới được thẩm định bằng bộ kiểm tra độ phức tạp `passwordStrength`, từ chối các mật khẩu yếu (`weak`).
3. **Chống tấn công tương tranh (Race Condition) và Replay**:
   - Giao dịch sử dụng `SELECT ... FOR UPDATE` khóa độc quyền dòng dữ liệu của yêu cầu đặt lại mật khẩu, ngăn chặn việc gửi nhiều request đồng thời để đoán mã.
   - Khi đã tiêu thụ thành công, `consumed_at` được đóng dấu thời gian; các lần gửi lại sau đó đều bị từ chối với lỗi `EXPIRED/INVALID`.
4. **Thu hồi phiên đăng nhập toàn diện**:
   - `UPDATE users SET session_version = session_version + 1` làm mất hiệu lực ngay lập tức tất cả JWT session cookie hiện có của người dùng trên mọi trình duyệt.

---

## 6. Kế hoạch hành động khuyến nghị (Next Steps)

1. **Ưu tiên 1 (Nên xử lý ngay)**:
   - Khắc phục **SEC-008**: Bổ sung câu lệnh cập nhật `consumed_at = now()` cho các yêu cầu cũ của cùng `user_id` khi tạo OTP mới.
   - Khắc phục **SEC-007**: Bổ sung rate limiting theo IP và toàn cục tại `POST /api/auth/password-reset/request` để ngăn chặn spam email OTP hàng loạt.
2. **Ưu tiên 2 (Bảo trì & Vận hành)**:
   - Khắc phục **SEC-010**: Bổ sung câu lệnh xóa các bản ghi `password_reset_requests` quá hạn vào script retention định kỳ.
