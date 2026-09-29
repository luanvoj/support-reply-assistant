# Tổng hợp kế hoạch kiến trúc & phát triển hệ thống (Consolidated Architecture Plans)

Tài liệu này tổng hợp toàn bộ 28 kế hoạch phát triển và chuẩn hóa tính năng của dự án **Trợ lý phản hồi**, được cấu trúc theo 5 trụ cột kiến trúc cốt lõi nhằm phục vụ việc theo dõi, bảo trì và mở rộng hệ thống.

---

## Trụ cột 1: Xác thực, Danh tính & Vòng đời Tài khoản (Auth & Identity Lifecycle)

### 1.1. Chuẩn hóa Màn hình Đăng nhập & Xác thực An toàn
- **Bối cảnh & Vấn đề**: Giao diện đăng nhập trước đây hiển thị các nút SSO/Okta chưa có backend contract thật, gây hiểu nhầm cho người dùng.
- **Quyết định kiến trúc**:
  - Loại bỏ hoàn toàn các CTA đăng nhập bên ngoài (SSO) chưa triển khai; tập trung vào luồng xác thực thực tế bằng email/password và phiên làm việc `httpOnly`.
  - Bổ sung minh họa trực quan luồng vận hành tri thức và nguyên tắc phản hồi có căn cứ ngay tại màn hình đăng nhập.
  - Áp dụng cơ chế giới hạn tần suất (Rate Limiting) trực tiếp trong PostgreSQL dựa trên địa chỉ IP và danh tính chuẩn hóa, trả về mã `429` kèm header `Retry-After` khi vượt ngưỡng để chống tấn công dò mật khẩu (brute-force).

### 1.2. Hồ sơ Người dùng, Đổi Mật khẩu Realtime & Xác thực Hai bước (TOTP MFA)
- **Bối cảnh & Vấn đề**: Người dùng cần cơ chế tự quản lý bảo mật cá nhân minh bạch, dễ thao tác và an toàn.
- **Quyết định kiến trúc**:
  - **Chính sách mật khẩu**: Bắt buộc tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và ký tự đặc biệt; hiển thị danh sách kiểm tra (checklist) phản hồi realtime ngay khi nhập.
  - **MFA (TOTP)**: Cung cấp mã QR và Secret key mã hóa để kích hoạt 2FA qua ứng dụng Authenticator; mã TOTP chỉ được chấp nhận sau bước xác thực thành công lần đầu và có cơ chế chống tái sử dụng mã (anti-replay).
  - **Avatar**: Cho phép tải ảnh đại diện cá nhân (JPEG, PNG, WebP), giới hạn 5 MB, server-side kiểm tra định dạng và chuẩn hóa sang WebP, lưu trữ tại thư mục bảo mật ngoài web root, chỉ cho phép chính chủ truy cập.

### 1.3. Quản trị Tài khoản, Khôi phục An toàn & Phân quyền RBAC
- **Bối cảnh & Vấn đề**: Quản trị viên cần công cụ hỗ trợ người dùng khi quên mật khẩu hoặc mất thiết bị 2FA mà không làm lộ thông tin nhạy cảm.
- **Quyết định kiến trúc**:
  - **Phân quyền 3 cấp (RBAC)**: `sales` (tư vấn), `technical` (chuyên gia kỹ thuật), `admin` (quản trị viên), kiểm tra nghiêm ngặt ở server-side API.
  - **Admin Recovery**: Quản trị viên có quyền đặt lại mật khẩu mới hoặc tắt 2FA của người dùng khác (không áp dụng cho chính mình). Thao tác này ngay lập tức thu hồi toàn bộ phiên đăng nhập hiện hữu và ghi nhận vào Nhật ký vận hành (Operational Log).

### 1.4. Vòng đời Vô hiệu hóa, Kế thừa Dữ liệu & Xóa Vĩnh viễn (Successor Lifecycle)
- **Bối cảnh & Vấn đề**: Khi nhân sự nghỉ việc, việc xóa tài khoản đột ngột làm đứt gãy quyền sở hữu bài viết tri thức và các câu hỏi đang mở.
- **Quyết định kiến trúc**:
  - **Khóa tạm thời (Disable)**: Khóa đăng nhập có thể đảo ngược mà không làm mất dữ liệu, cấu hình bảo mật hay phân công hiện tại.
  - **Xóa có chỉ định kế thừa (Hard-delete with Successor)**: Bắt buộc chọn người kế thừa hợp lệ theo thứ bậc phân quyền (`sales` → `technical` → `admin`). Chuyển giao toàn bộ bài viết tri thức và yêu cầu chuyên gia đang mở cho người kế thừa trước khi xóa sạch thông tin nhạy cảm (PII, avatar, mật khẩu, 2FA).
  - Ngăn chặn tuyệt đối việc xóa tài khoản Quản trị viên hoạt động cuối cùng trong hệ thống.

---

## Trụ cột 2: Tích hợp AI Provider, Khả năng Chịu lỗi & Chế độ Suy thoái (AI Resilience)

### 2.1. Quản lý Nhà cung cấp AI Độc lập & Quy tắc Single Active Agent
- **Bối cảnh & Vấn đề**: Cần tích hợp linh hoạt giữa Google Gemini và Azure OpenAI mà không gây xung đột cấu hình.
- **Quyết định kiến trúc**:
  - Lưu trữ cấu hình Google Gemini và Azure OpenAI độc lập trong cơ sở dữ liệu; khóa API được mã hóa an toàn ở tầng server và không bao giờ gửi về client.
  - Quy tắc bảo đảm toàn vẹn dữ liệu: Tại một thời điểm chỉ cho phép duy nhất một nhà cung cấp AI được kích hoạt (`isEnabled = true`). Kích hoạt một nhà cung cấp mới sẽ tự động hủy kích hoạt nhà cung cấp hiện tại.

### 2.2. Khả năng Chịu lỗi (Resilience), Circuit Breaker & Retry Contract
- **Bối cảnh & Vấn đề**: Khi dịch vụ AI bên ngoài gặp sự cố mạng hoặc quá tải, ứng dụng không được phép treo hoặc sụp đổ.
- **Quyết định kiến trúc**:
  - Triển khai cơ chế Retry có khoảng lùi lũy thừa (Exponential Backoff) kết hợp trạng thái ngắt mạch (Circuit Breaker Cooldown) cho mọi lời gọi API sang AI provider.
  - Thiết lập timeout chặt chẽ cho các tác vụ tổng hợp câu trả lời, xếp hạng lại (re-rank) và phân tích đề xuất gộp tri thức.

### 2.3. Chế độ Tra cứu Tri thức Suy thoái (Degraded Knowledge Mode)
- **Bối cảnh & Vấn đề**: Khi AI provider tạm thời mất kết nối hoặc bị tắt, người dùng tư vấn vẫn cần tra cứu được thông tin.
- **Quyết định kiến trúc**:
  - Tách biệt hoàn toàn luồng truy xuất tri thức khỏi sự sẵn sàng của Agent AI.
  - Nếu Agent ngoại tuyến nhưng Kho tri thức có bài viết phù hợp vượt ngưỡng an toàn, hệ thống tự động chuyển sang chế độ suy thoái: hiển thị các đoạn trích nguồn đã xác minh cho nhân viên thay vì báo lỗi toàn bộ màn hình. Tuyệt đối không tự suy đoán thông tin khi không có căn cứ.

---

## Trụ cột 3: Kho Tri thức & Gộp Bài viết Thông minh (Knowledge & Smart Merge)

### 3.1. Quản trị Kho Tri thức, Preview Import & Xóa Vĩnh viễn An toàn
- **Bối cảnh & Vấn đề**: Tài liệu tri thức nội bộ cần được nhập khẩu, cập nhật và dọn dẹp thường xuyên mà không làm hỏng tính toàn vẹn của dữ liệu tham chiếu.
- **Quyết định kiến trúc**:
  - **Nhập dữ liệu theo lô**: Hỗ trợ CSV và Excel (XLSX), giới hạn 5 MB và 200 dòng, hiển thị bảng kiểm tra trước (Preview Modal) với cảnh báo lỗi chi tiết trước khi ghi vào cơ sở dữ liệu.
  - **Vòng đời tài liệu**: Bài viết có các trạng thái `draft`, `published`, `archived`. Chỉ tài liệu `published` và đúng chính sách mới được đưa vào chỉ mục tra cứu của Trợ lý.
  - **Xóa vĩnh viễn (Permanent Delete)**: Áp dụng transaction an toàn để xóa bài viết đã lưu trữ, dọn dẹp sạch sẽ các đoạn văn bản (chunks), liên kết trích dẫn và bản nháp gộp liên đới; ghi log kiểm toán đầy đủ.

### 3.2. Không gian Gộp Bài viết Thông minh (Smart Merge Workspace) theo chuẩn Modern Bento
- **Bối cảnh & Vấn đề**: Các bài viết tương đồng hoặc trùng lặp nội dung cần được gộp lại để tối ưu hóa nguồn tri thức RAG, nhưng giao diện cũ bị phân tán và thiếu tính trực quan.
- **Quyết định kiến trúc**:
  - **Bento Workspace Header**: Nhãn nghiệp vụ phân tầng rõ ràng `KHÔNG GIAN LÀM VIỆC TRI THỨC / QUÉT & ĐỐI CHIẾU THÔNG MINH`.
  - **Bento KPI Grid**: Hiển thị 4 thẻ chỉ số quét trực quan theo thời gian thực (Tổng ứng viên, Đã phân tích, Đã tạo nháp, Đã hợp nhất an toàn).
  - **Bộ chọn ngưỡng tương đồng nhanh**: Preset ngưỡng tương đồng (65% Khám phá rộng, 75% Tiêu chuẩn, 85% Nghiêm ngặt) kèm thanh trượt linh hoạt.
  - **Modal đối chiếu 2 cột (Diff Modal)**: Hiển thị song song nội dung các bài viết nguồn và bản nháp tổng hợp do Agent đề xuất, cho phép người thẩm định rà soát kỹ lưỡng trước khi bấm Phê duyệt (xuất bản bài mới và tự động lưu trữ bài cũ).
  - **Xác thực trạng thái đính kèm**: Endpoint attach bản nháp kiểm tra nghiêm ngặt trạng thái ứng viên `('candidate', 'selected', 'generating', 'failed')` trước khi chuyển sang `drafted`, trả về mã an toàn `409 Conflict` nếu nhóm đã được xử lý.

---

## Trụ cột 4: Hàng đợi Chuyên gia & Thẩm định Tri thức (Expert Request Queue & Review)

### 4.1. Luồng Tự động Chuyển giao Yêu cầu Chuyên gia
- **Bối cảnh & Vấn đề**: Khi câu hỏi của nhân viên tư vấn không tìm thấy tài liệu phù hợp trong kho tri thức hoặc điểm căn cứ dưới ngưỡng an toàn, câu hỏi có nguy cơ bị bỏ quên.
- **Quyết định kiến trúc**:
  - Hệ thống tự động tạo một **Yêu cầu chuyên gia** kèm mã định danh (ticket) và lý do cụ thể (thiếu tài liệu nguồn, căn cứ thấp hơn ngưỡng cấu hình, hoặc tài liệu nhạy cảm cần xác nhận).
  - Liên kết 1-1 chặt chẽ giữa câu hỏi, phản hồi của Trợ lý và phiếu yêu cầu chuyên gia, không tạo phiếu trùng lặp khi cùng một câu hỏi được gửi nhiều lần.

### 4.2. Không gian Xử lý Master-Detail & Bộ lọc Phân trang Server-side
- **Bối cảnh & Vấn đề**: Danh sách hàng đợi phình to khiến việc tìm kiếm và xử lý phiếu bị chậm.
- **Quyết định kiến trúc**:
  - Thiết kế kiến trúc Master-Detail với phân trang và tìm kiếm hoàn toàn ở tầng server-side (`GET /api/unanswered`).
  - Lọc trạng thái phiếu rõ ràng (`new`, `in_review`, `answered`, `published`, `rejected`), với tùy chọn `status=open` để tập trung vào các phiếu đang cần xử lý ngay.
  - Hỗ trợ Deep Link trực tiếp đến phiếu đang chọn ngay cả khi phiếu đó nằm ở trang khác trong kết quả phân trang.

### 4.3. Top-Editor Biên tập & Xóa An toàn Yêu cầu Chưa Xử lý
- **Bối cảnh & Vấn đề**: Thao tác thẩm định và biên tập câu trả lời cần không gian rộng rãi, tập trung; đồng thời các câu hỏi rác hoặc câu hỏi thử nghiệm cần được xóa sạch.
- **Quyết định kiến trúc**:
  - Thiết kế khung soạn thảo một cột (Top-Editor) nổi bật ở đầu trang khi chọn phiếu, giúp chuyên gia tập trung chuẩn hóa câu trả lời và có tùy chọn xuất bản trực tiếp thành bài viết mới trong Kho tri thức.
  - Cho phép người có thẩm quyền (`technical`, `admin`) xóa vĩnh viễn các yêu cầu mới (`status = 'new'`) chưa qua thẩm định, tự động đồng bộ lại trạng thái hội thoại từ `escalated` về `normal`.

---

## Trụ cột 5: Trải nghiệm Người dùng, Bento Design System & Nhật ký Vận hành (UI/UX & Ops)

### 5.1. Hệ thống Giao diện Modern Bento Layout & Ambient Aurora
- **Bối cảnh & Vấn đề**: Giao diện trước đây phẳng, đơn điệu (chỉ có màu trắng và xám nhẹ), thiếu chiều sâu và cảm xúc hiện đại.
- **Quyết định kiến trúc**:
  - **Màu nền Ambient Aurora Mesh Gradient (`.bento-shell`)**: Kết hợp dải chuyển màu đa tầng từ các điểm phát quang mờ (Indigo, Sky Cyan, Soft Violet, Emerald) hòa vào nền xám sương mai, tạo chiều sâu không gian cao cấp mà không gây chói mắt.
  - **Thanh điều hướng Frosted Glass**: Sidebar và Topbar áp dụng kính mờ (`backdrop-filter: blur(20px)` và `blur(16px)`), viền bán trong suốt sang trọng.
  - **Bento Icon Badge Tiles**: Mỗi mục điều hướng sở hữu một hộp biểu tượng riêng biệt (32×32px, bo góc `9px`) với màu sắc nhận diện đặc trưng theo nghiệp vụ và hiệu ứng phát quang khi active.
  - **Chuẩn hóa nhãn Eyebrow & Desc trên 9 màn hình**: Loại bỏ tình trạng lặp breadcrumb, áp dụng nhãn nghiệp vụ chuyên nghiệp (VD: `HỎI ĐÁP & HỖ TRỢ / TRỢ LÝ TRUY XUẤT CĂN CỨ`, `HÀNG ĐỢI NGHIỆP VỤ / YÊU CẦU CẦN CHUYÊN GIA XÁC NHẬN`).

### 5.2. Trang Hướng dẫn Sử dụng Đa vai trò (User Guide Landing Page)
- **Bối cảnh & Vấn đề**: Người dùng ở các vai trò khác nhau (Sales, Chuyên gia, Admin) cần hiểu rõ cách hệ thống hoạt động và lộ trình thao tác phù hợp.
- **Quyết định kiến trúc**:
  - Xây dựng trang Hướng dẫn sử dụng trực quan, phân tách lộ trình rõ ràng theo từng vai trò: Nhân viên tư vấn, Chuyên gia thẩm định, Quản trị viên.
  - Trực quan hóa sơ đồ luồng hoạt động của Agent, giải thích cơ chế tính Điểm căn cứ (Grounding Score) và ý nghĩa thực tế của từng tham số cấu hình.

### 5.3. Nhật ký Vận hành (Operational Logs) & Quản lý Thời hạn Lưu giữ
- **Bối cảnh & Vấn đề**: Cần giám sát hoạt động hệ thống mà không vi phạm quyền riêng tư hay bảo mật thông tin.
- **Quyết định kiến trúc**:
  - Lưu vết các sự kiện trọng yếu thuộc 4 nhóm: `authentication`, `account`, `knowledge`, `configuration`.
  - Bộ lọc server-side theo khoảng thời gian thực tế (chuẩn hóa theo múi giờ Việt Nam `Asia/Saigon`), phân loại danh mục và phân trang rõ ràng.
  - Nguyên tắc bảo mật tuyệt đối: Nhật ký vận hành không bao giờ ghi lại nội dung hội thoại, mật khẩu, API key, mã OTP hay dữ liệu hình ảnh.
  - Hỗ trợ quản trị viên cấu hình thời hạn lưu giữ (từ 7 đến 3650 ngày) và cung cấp lệnh dọn dẹp định kỳ (`npm run operational-logs:retention -- --apply`).

---

## Bảng Đối Chiếu 28 Kế Hoạch Gốc & Trạng Thái

| STT | Kế hoạch gốc | Trụ cột phân bổ | Trạng thái hiện hành |
|:---:|---|:---:|:---:|
| 1 | `2026-09-27-login-auth-surface.md` | Trụ cột 1 | Đã hoàn thành, đang vận hành |
| 2 | `2026-09-27-profile-password-and-mfa-ux.md` | Trụ cột 1 | Đã hoàn thành, đang vận hành |
| 3 | `2026-09-27-user-management-identity-and-2fa.md` | Trụ cột 1 | Đã hoàn thành, đang vận hành |
| 4 | `2026-09-27-admin-user-security-recovery.md` | Trụ cột 1 | Đã hoàn thành, đang vận hành |
| 5 | `2026-09-28-auth-throttling-and-import-hardening.md` | Trụ cột 1 | Đã hoàn thành, đang vận hành |
| 6 | `2026-09-28-user-disable-delete-successor-lifecycle.md` | Trụ cột 1 | Đã hoàn thành, đang vận hành |
| 7 | `2026-09-27-provider-configuration-and-activation-ux.md` | Trụ cột 2 | Đã hoàn thành, đang vận hành |
| 8 | `2026-09-27-provider-resilience-coverage.md` | Trụ cột 2 | Thiết kế chuẩn hóa đã áp dụng |
| 9 | `2026-09-27-provider-degraded-knowledge-mode.md` | Trụ cột 2 | Đã hoàn thành, đang vận hành |
| 10 | `2026-09-27-settings-behavior-regression-audit.md` | Trụ cột 2 | Đã rà soát & nghiệm thu |
| 11 | `knowledge-workspace-layout-and-actions.md` | Trụ cột 3 | Đã hoàn thành, đang vận hành |
| 12 | `merge-flow-guidance-and-pair-decisions.md` | Trụ cột 3 | Đã hoàn thành, đang vận hành |
| 13 | `merge-draft-error-ux.md` | Trụ cột 3 | Đã hoàn thành, đang vận hành |
| 14 | `2026-09-28-knowledge-hard-delete-and-expert-queue.md` | Trụ cột 3 | Đã hoàn thành, đang vận hành |
| 15 | `2026-09-27-expert-request-workflow.md` | Trụ cột 4 | Đã hoàn thành, đang vận hành |
| 16 | `2026-09-27-expert-request-master-detail-pagination.md` | Trụ cột 4 | Đã hoàn thành, đang vận hành |
| 17 | `2026-09-27-expert-request-deduplication.md` | Trụ cột 4 | Thiết kế group đã áp dụng |
| 18 | `2026-09-28-delete-new-expert-requests.md` | Trụ cột 4 | Đã hoàn thành, đang vận hành |
| 19 | `2026-09-28-expert-request-top-editor-layout.md` | Trụ cột 4 | Đã hoàn thành, đang vận hành |
| 20 | `application-design-system-audit.md` | Trụ cột 5 | Đã hoàn thành, đang vận hành |
| 21 | `2026-09-27-settings-layout-system.md` | Trụ cột 5 | Đã hoàn thành, đang vận hành |
| 22 | `2026-09-27-sidebar-account-menu.md` | Trụ cột 5 | Đã hoàn thành, đang vận hành |
| 23 | `2026-09-27-unify-dashboard-app-shell.md` | Trụ cột 5 | Đã hoàn thành, đang vận hành |
| 24 | `2026-09-27-deferred-header-actions.md` | Trụ cột 5 | Hoãn các CTA chưa có logic |
| 25 | `2026-09-27-user-guide-landing-page.md` | Trụ cột 5 | Đã hoàn thành, đang vận hành |
| 26 | `2026-09-28-hard-delete-and-operational-log.md` | Trụ cột 5 | Đã hoàn thành, đang vận hành |
| 27 | `2026-09-28-operational-log-time-filter-pagination.md` | Trụ cột 5 | Đã hoàn thành, đang vận hành |
| 28 | `2026-09-27-vibehost-mcp-and-deployment.md` | Trụ cột 5 | Đã chuẩn bị sẵn sàng |
