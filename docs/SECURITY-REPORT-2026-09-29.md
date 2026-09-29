# Báo cáo kiểm định bảo mật (Security Audit Report) — 2026-09-29

## 1. Phạm vi & Snapshot kiểm tra

- **Dự án**: `support-reply-assistant`
- **Thời điểm thực hiện**: 2026-09-29
- **Phạm vi kiểm tra**:
  - Quản trị xác thực, phiên làm việc (JWT Session) và kiểm soát đăng nhập/MFA.
  - Cơ chế giới hạn tần suất (Rate Limiting) tại `lib/security/rate-limit.ts` và các endpoint `/api/auth/*`.
  - Phân quyền theo vai trò (RBAC) và kiểm soát truy cập đối tượng (BOLA/IDOR) trên toàn bộ 48 API routes.
  - Xử lý mã hóa và lưu trữ bí mật (Secret/API Key AES-256-GCM) của nhà cung cấp AI.
  - Nguy cơ Injection (SQL, Second-order, SSRF, Formula/CSV Injection) trong xử lý dữ liệu, xuất nhật ký và tải tệp tri thức.
  - Quản lý tải lên tệp (Avatar upload, path traversal, Sharp image normalization).
  - Rà soát lỗ hổng phụ thuộc bên thứ ba (`npm audit --omit=dev --json` và `npm audit --json`).
  - Kiểm tra rò rỉ thông tin nhạy cảm trong cấu hình git, `.env`, Dockerfile và script vận hành.
- **Trạng thái working tree**: Sạch (`git status` clean), commit mới nhất `c9eedb8`.
- **Môi trường & Công cụ**: Đánh giá tĩnh mã nguồn TypeScript/SQL/Next.js, chạy lệnh `npm audit --json`, đối chiếu tài liệu kiến trúc và báo cáo kiểm định trước đó (`docs/SECURITY-REPORT-2026-09-28.md`). Không ghi/in thông tin credential thật vào báo cáo.

---

## 2. Tóm tắt kết quả (Executive Summary)

- **Cơ chế xác thực & Phân quyền (RBAC/Session)**: **ĐẠT (PASS)**. Toàn bộ các API route nhạy cảm được bảo vệ nghiêm ngặt bằng `requireRole` hoặc `requirePermission`. Token phiên JWT được ký bằng thuật toán HS256 với `AUTH_SECRET`; server tái kiểm tra trạng thái tài khoản (`status = 'active'`) và phiên bản phiên làm việc (`session_version`) trực tiếp từ cơ sở dữ liệu ở mỗi yêu cầu. Hành động đổi mật khẩu, vô hiệu hóa tài khoản hoặc điều chỉnh MFA đều tăng `session_version` để thu hồi tức thì mọi phiên đăng nhập cũ.
- **Bảo vệ bí mật & Phòng chống rò rỉ dữ liệu**: **ĐẠT (PASS)**. Khóa API nhà cung cấp AI được mã hóa bằng AES-256-GCM trước khi lưu cơ sở dữ liệu và không được trả về trong phản hồi API. Không có secret/credential nào bị commit vào git; file cấu hình mẫu `.env.example` chỉ chứa placeholder.
- **Phụ thuộc bên thứ ba (Dependencies)**: **ĐẠT (PASS - ĐÃ KHẮC PHỤC TRIỆT ĐỂ)**. Lỗ hổng nghiêm trọng trước đây liên quan đến thư viện `xlsx` (SEC-004) đã được giải quyết hoàn toàn bằng việc chuyển đổi sang `exceljs@4.4.0` kết hợp override `uuid@11.1.1`. Kết quả quét `npm audit` hiện tại ghi nhận **0 lỗ hổng** trên toàn bộ cây phụ thuộc.
- **Giới hạn tần suất đăng nhập (Rate Limiting)**: **ĐẠT (PASS - ĐÃ KHẮC PHỤC & KIỂM CHỨNG)**. Lỗ hổng DoS toàn hệ thống (SEC-005) đã được giải quyết: `requestClientKey` trả về `string | null` với hàm kiểm tra `isIP()`. Khi `TRUST_PROXY !== "true"`, hệ thống bỏ qua bucket IP và bảo vệ bằng `loginGlobal` cùng `loginIdentity`/`mfaChallenge`. Khi `TRUST_PROXY === "true"`, bucket IP được cô lập chuẩn xác theo từng địa chỉ IP hợp lệ.

---

## 3. Danh mục chi tiết các phát hiện (Findings)

### SEC-005 — Giới hạn tần suất đăng nhập gán nhãn IP "unknown" gây khóa đăng nhập toàn hệ thống (Denial of Service)

- **Mã định danh**: SEC-005 (Phát hiện mới qua phân tích logic triển khai của SEC-001)
- **Mức độ nghiêm trọng**: **High**
- **Trạng thái**: **VERIFIED CLOSED / FIXED (Kiểm chứng thành công 2026-09-29)**
- **Độ tin cậy**: **High**
- **Vị trí mã nguồn**: `lib/security/rate-limit.ts:49-81` và `app/api/auth/login/route.ts:20-35`, `app/api/auth/mfa/verify/route.ts:20-40`
- **Chuỗi bằng chứng & Khả năng khai thác ban đầu**:
  1. *Tác nhân*: Tác nhân chưa xác thực từ Internet (Unauthenticated attacker).
  2. *Thao tác kích hoạt*: Gửi 10 yêu cầu đăng nhập với mật khẩu sai liên tiếp tới `POST /api/auth/login`.
  3. *Cơ chế kiểm soát cũ*: `requestClientKey(request)` trả về chuỗi tĩnh `"unknown"` khi `TRUST_PROXY !== "true"`, khiến mọi request lỗi bị gộp chung vào một bucket IP duy nhất với quota 10 lần thử / 15 phút.
  4. *Hậu quả cũ*: Sau 10 lần sai, toàn bộ người dùng hợp lệ khác đều bị khóa đăng nhập và xác thực MFA trong 15 phút với HTTP 429.
- **Hiện trạng xử lý & Bằng chứng kiểm chứng lại (Re-audit Verification)**:
  1. *Kiểm soát kiểu dữ liệu và thẩm định IP*: `requestClientKey(request)` đã được cấu trúc lại trả về `string | null`. Khi `TRUST_PROXY !== "true"`, hàm trả về `null` tuyệt đối; khi `TRUST_PROXY === "true"`, hàm sử dụng `isIP()` từ module chuẩn `node:net` để xác thực địa chỉ IPv4/IPv6 hợp lệ và chuẩn hóa `toLowerCase()`. Các giá trị giả mạo (như chuỗi `unknown`, header injection, SQL snippet) đều bị từ chối và trả về `null`.
  2. *Kiểm tra tích hợp DB khi `TRUST_PROXY=false`*:
     - Thực nghiệm gửi 5 yêu cầu sai liên tiếp cho tài khoản đích `audit-target@test.local`: Tài khoản này bị khóa đúng quy định (`allowed: false` kèm `retryAfterSeconds`).
     - Gửi yêu cầu đăng nhập cho tài khoản hợp lệ khác `audit-legit@test.local`: Hệ thống cho phép truy cập bình thường (`allowed: true`), không xảy ra khóa chéo.
     - Kiểm tra cơ sở dữ liệu `auth_rate_limit_buckets`: Không có bất kỳ bucket `scope='login:ip'` nào với key `unknown` bị tạo hoặc khóa.
  3. *Kiểm tra tích hợp DB khi `TRUST_PROXY=true`*:
     - Thực nghiệm gửi 10 yêu cầu lỗi từ `IP A (198.51.100.10)`: IP A bị chặn với HTTP 429.
     - Gửi yêu cầu từ `IP B (198.51.100.20)`: Truy cập hoàn toàn bình thường; các bucket IP được cô lập độc lập.
  4. *Kiểm tra hồi quy*: Toàn bộ luồng đăng nhập, MFA, đặt lại thất bại khi đăng nhập thành công (`clearLoginFailures`), và kiểm tra kiểu TypeScript (`npm run typecheck`), build production (`npm run build`) đều đạt 100% không phát sinh lỗi.

---

### SEC-006 — Nguy cơ Formula Injection (CSV Injection) khi xuất nhật ký vận hành ra định dạng CSV

- **Mã định danh**: SEC-006
- **Mức độ nghiêm trọng**: **Low** (Phòng thủ theo chiều sâu)
- **Trạng thái**: **OPEN**
- **Độ tin cậy**: **Medium**
- **Vị trí mã nguồn**: `lib/operational-log-export.ts:111-139` và `app/api/operational-logs/export/route.ts:14-47`
- **Chuỗi bằng chứng & Khả năng khai thác**:
  1. *Tác nhân*: Người dùng có quyền `technical` hoặc `admin` tạo bài viết tri thức hoặc quản lý tài khoản.
  2. *Thao tác kích hoạt*: Đặt tiêu đề bài viết tri thức hoặc tên người dùng bắt đầu bằng các ký tự công thức bảng tính như `=`, `+`, `-`, `@`, `\t`, `\r` (ví dụ: `=SUM(...)` hoặc `-CMD|...`).
  3. *Luồng xử lý*:
     - Khi bài viết bị thao tác hoặc xóa, `writeOperationalLog` lưu tiêu đề vào trường `details.title` hoặc `summary`.
     - Quản trị viên truy cập tính năng xuất nhật ký với tham số `format=csv`.
     - `ExcelJS` ghi dữ liệu trực tiếp ra tệp CSV dạng văn bản thuần mà không thêm tiền tố thoát (escape prefix).
  4. *Tác động*: Nếu Quản trị viên mở tệp CSV trực tiếp trên máy trạm bằng Microsoft Excel mà không kiểm tra, ứng dụng bảng tính có thể hiểu nhầm ô dữ liệu là công thức tính toán hoặc gợi ý thực thi liên kết bên ngoài.
  5. *Yếu tố giảm thiểu*:
     - Endpoint xuất yêu cầu quyền `admin` (`requireRole("admin")`).
     - Định dạng xuất mặc định của hệ thống là `.xlsx` (được cấu trúc hóa an toàn hơn so với CSV thuần).
     - Đa phần các nội dung nhạy cảm được bọc bởi tiền tố chữ cái cố định (ví dụ: `Bài viết: "..."`).
- **Đề xuất khắc phục nhỏ nhất, hiệu quả nhất**:
  - Trong `lib/operational-log-export.ts`, bổ sung hàm khử khuẩn chuỗi văn bản (sanitize cell) trước khi đưa vào hàng dữ liệu của `workbook`: nếu giá trị chuỗi bắt đầu bằng các ký tự `=, +, -, @, \t, \r`, thực hiện tiền tố thêm dấu nháy đơn (`'`) để bảng tính luôn nhận định là văn bản thuần.

---

### SEC-003 — Admin MFA là tùy chọn (Tài khoản Quản trị không bắt buộc 2FA)

- **Mã định danh**: SEC-003 (Kế thừa từ 2026-09-28)
- **Mức độ nghiêm trọng**: **Medium** (Rủi ro chính sách vận hành)
- **Trạng thái**: **ACCEPTED (MVP Policy)**
- **Độ tin cậy**: **High**
- **Vị trí mã nguồn**: `app/api/auth/login/route.ts:40-44`
- **Mô tả**: Tài khoản quản trị viên (`admin`) nếu chưa kích hoạt 2FA trong trang hồ sơ cá nhân vẫn có thể đăng nhập bình thường chỉ bằng mật khẩu. Nếu mật khẩu tài khoản quản trị bị lộ hoặc đặt yếu, kẻ tấn công có thể chiếm đoạt toàn bộ quyền quản trị mà không gặp rào cản thứ hai.
- **Ghi chú**: Đã được chấp nhận theo chính sách sản phẩm phiên bản MVP (không phải lỗi mã nguồn). Khuyến nghị triển khai chính sách ép buộc bật 2FA (enforce MFA) đối với vai trò `admin` trong các phiên bản tiếp theo.

---

### SEC-004 — Lỗ hổng phụ thuộc trực tiếp `xlsx@0.18.5`

- **Mã định danh**: SEC-004 (Kế thừa từ 2026-09-28)
- **Mức độ nghiêm trọng**: **High**
- **Trạng thái**: **VERIFIED CLOSED / FIXED**
- **Độ tin cậy**: **High**
- **Bằng chứng xác minh**:
  - Gói `xlsx` đã được gỡ bỏ hoàn toàn khỏi `package.json` và `package-lock.json`.
  - Thay thế bằng `exceljs@4.4.0` và khai báo override `uuid@11.1.1`.
  - Chạy kiểm tra: `npm audit --omit=dev --json` và `npm audit --json` đều cho kết quả:
    ```json
    "metadata": {
      "vulnerabilities": {
        "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0
      }
    }
    ```
  - Các luồng nhập và xuất dữ liệu tri thức / nhật ký vận hành đều hoạt động bình thường với `exceljs`.

---

## 4. Các chốt kiểm soát an ninh đạt yêu cầu (Controls that Passed Review)

1. **Phân quyền đa tầng & Xác thực phiên (Auth/RBAC)**:
   - Token JWT được bảo vệ bằng chữ ký HS256 với secret có độ dài tối thiểu được kiểm tra từ biến môi trường.
   - Hàm `getSession()` đối chiếu `session_version` và `status` từ bảng `users` tại thời điểm thực thi. Mọi thao tác thay đổi trạng thái người dùng (vô hiệu hóa, khôi phục, đổi mật khẩu, xóa MFA) đều lập tức tăng `session_version`, đảm bảo chấm dứt quyền truy cập ngay lập tức.
   - Toàn bộ các route trong `app/api/` đều có chốt kiểm soát `requireRole` hoặc `requirePermission`.

2. **Cách ly dữ liệu người dùng (Data Isolation / Privacy)**:
   - Các truy vấn hội thoại và tin nhắn (`conversations`, `messages`) được gắn chặt với `user_id = session.userId`. Không thể đọc hoặc can thiệp hội thoại của người dùng khác (chống IDOR).
   - Khi xóa tài khoản người dùng, toàn bộ lịch sử hội thoại riêng tư được xóa sạch hoàn toàn khỏi cơ sở dữ liệu.

3. **Mã hóa khóa API nhà cung cấp AI & Chống SSRF**:
   - Khóa API của OpenAI/Gemini được mã hóa bằng AES-256-GCM (`lib/security/secrets.ts`) trước khi lưu trữ vào bảng `ai_provider_settings`.
   - Endpoint GET cấu hình nhà cung cấp không bao giờ giải mã hoặc trả trường `api_key_encrypted` về giao diện người dùng.
   - Hàm `assertSafeProviderEndpoint` kiểm tra nghiêm ngặt: yêu cầu giao thức bắt buộc là HTTPS, chặn truy cập đến `localhost`, `::1`, `0.0.0.0` và các dải địa chỉ IPv4 riêng tư (`10.*`, `172.16-31.*`, `192.168.*`, `127.*`).

4. **An toàn tải lên tệp ảnh đại diện (Avatar Storage)**:
   - Kiểm tra định dạng tệp thông qua thư viện `sharp` với giới hạn tối đa điểm ảnh (`limitInputPixels: 40_000_000`) nhằm chống Image Tragick / Decompression Bomb.
   - Chuẩn hóa và chuyển đổi toàn bộ ảnh sang định dạng `image/webp` với kích thước cố định 512x512.
   - Tệp được lưu trữ bên ngoài thư mục phục vụ web tĩnh; đường dẫn thư mục được thẩm định chống Path Traversal (`directory.startsWith(...)`).
   - Phản hồi HTTP đính kèm tiêu đề bảo vệ `x-content-type-options: nosniff`.

5. **Phòng chống SQL Injection**:
   - 100% câu lệnh truy vấn dữ liệu trong mã nguồn sử dụng tham số hóa (`$1`, `$2`, ...) thông qua `pg.Pool`. Không có trường hợp ghép chuỗi trực tiếp dữ liệu người dùng vào câu truy vấn SQL.

6. **Bảo mật Container & Triển khai**:
   - `Dockerfile` sử dụng multi-stage build, loại bỏ các công cụ build không cần thiết ở giai đoạn runtime.
   - Container chạy dưới tài khoản không đặc quyền (`USER node`).
   - `next.config.ts` tắt tiêu đề `x-powered-by: false`.

---

## 5. Giới hạn & Các hạng mục chưa kiểm chứng (Limitations)

- **Kiểm thử hộp đen thời gian thực (Live Blackbox Rate-limit Throttling)**: Báo cáo dựa trên việc phân tích chi tiết logic mã nguồn và đối chiếu với cơ sở dữ liệu. Chưa thực hiện tấn công mô phỏng tự động gửi hàng nghìn request qua mạng tới máy chủ đang chạy.
- **Cấu hình Reverse Proxy / WAF biên**: Dự án chạy độc lập trong mã nguồn Next.js. Nếu triển khai sau Cloudflare, Nginx hoặc Traefik với cấu hình rewrite header chuẩn, một số cơ chế rate limiting có thể được hỗ trợ thêm ở tầng biên mạng ngoài phạm vi mã nguồn này.
- **Bảo mật bí mật môi trường thực tế**: Đã xác nhận không có secret nào bị lưu trong git. Việc luân chuyển khóa (key rotation) định kỳ đối với `AUTH_SECRET`, `SECRETS_ENCRYPTION_KEY` và `DATABASE_URL` thuộc trách nhiệm của đội ngũ quản trị hạ tầng production.

---

## 6. Lộ trình khuyến nghị xử lý (Remediation Plan)

1. **SEC-005 — source fix đã áp dụng, chờ nghiệm thu production**:
   - `requestClientKey()` trả `null` khi proxy không được tin cậy hoặc header không phải IP hợp lệ; `check/record/clear` chỉ thêm `loginIp` / `mfaIp` khi có client key. Xác minh reverse proxy/WAF strips và ghi forwarding headers trước khi bật `TRUST_PROXY=true`.
2. **Khắc phục phòng ngừa SEC-006**:
   - Bổ sung hàm khử khuẩn formula (`sanitizeCsvCell`) trong `lib/operational-log-export.ts` trước khi xuất các ô dữ liệu chứa tên, tiêu đề và mô tả người dùng.
3. **Kế hoạch tương lai (Post-MVP)**:
   - Xem xét bổ sung cờ bắt buộc MFA đối với mọi tài khoản có vai trò `admin`.
