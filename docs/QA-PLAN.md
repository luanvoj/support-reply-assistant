# Kế hoạch Đảm bảo Chất lượng (QA Plan) — Trợ lý phản hồi

Tài liệu này xác định mục tiêu, phạm vi, môi trường, rủi ro, phân loại kiểm thử và danh mục các Test Case chuẩn hóa nhằm phục vụ quá trình kiểm soát chất lượng (QC), nghiệm thu và phát hành ứng dụng **Trợ lý phản hồi**.

---

## 1. Mục tiêu & Phạm vi

### 1.1. Mục tiêu
- Bảo đảm tính đúng đắn, an toàn và toàn vẹn của dữ liệu trong toàn bộ quy trình RAG (Retrieval-Augmented Generation): chỉ trả lời khi có căn cứ, tự động chuyển chuyên gia khi thiếu dữ liệu.
- Xác thực tính ổn định của giao diện Modern Bento Layout (Ambient Aurora, Bento Icon Badge Tiles, Frosted Glass, Smart Merge Workspace, Top-Editor).
- Đảm bảo kiểm soát truy cập (RBAC) nghiêm ngặt ở tầng máy chủ, không cho phép leo quyền giữa các vai trò `sales`, `technical`, `admin`.
- Ngăn ngừa tình trạng mất mát dữ liệu khi thực hiện các tác vụ phá hủy (xóa bài viết, gộp bài, khóa/xóa tài khoản).

### 1.2. Phạm vi kiểm thử (Scope)
- **Xác thực & Danh tính**: Đăng nhập, rate limit chống brute-force, TOTP MFA hai bước, đổi mật khẩu realtime, avatar bảo mật, vòng đời tài khoản và người kế thừa (Successor).
- **Trợ lý Hỏi đáp (RAG Assistant)**: Tra cứu tri thức, trích dẫn nguồn, tính điểm căn cứ, tự động tạo yêu cầu chuyên gia (escalation) và chế độ suy thoái an toàn (Degraded Knowledge Mode) khi Agent ngoại tuyến.
- **Quản trị Kho tri thức**: Tạo mới, chỉnh sửa, xuất bản, lưu trữ, nhập khẩu CSV/XLSX có kiểm tra trước (Preview Modal) và xóa vĩnh viễn (Permanent Delete) có transaction an toàn.
- **Gộp bài viết thông minh (Smart Merge Workspace)**: Lập đợt quét, tính điểm tương đồng, bộ chọn ngưỡng nhanh (65/75/85%), hiển thị KPI Grid, Modal đối chiếu 2 cột (Diff Modal), phê duyệt/từ chối và kiểm tra mã `409 Conflict` khi đính kèm.
- **Hàng đợi Chuyên gia (Expert Queue)**: Danh sách Master-Detail phân trang & tìm kiếm server-side, khung soạn thảo Top-Editor, xuất bản tri thức mới và xóa an toàn yêu cầu chưa xử lý (`status = 'new'`).
- **Cấu hình & Quản trị AI**: Thiết lập Gemini/Azure độc lập, quy tắc Single Active Agent, kiểm tra kết nối (Test connection) và Nhật ký vận hành (Operational Logs) có bộ lọc thời gian Việt Nam.
- **Giao diện & Trải nghiệm (UI/UX)**: Điều hướng Bento Icon Badge Tiles, nền Ambient Aurora, Frosted Glass, nhãn Eyebrow/Subtitle nghiệp vụ trên 9 màn hình, tương tác modal (Esc, click ngoài, focus trap) và độ phản hồi responsive.

### 1.3. Ngoài phạm vi (Out-of-Scope)
- Tải tệp hình ảnh/video vào nội dung bài viết tri thức (hệ thống chỉ lập chỉ mục văn bản thuần Markdown).
- Đăng nhập SSO bên thứ ba (Google OAuth, Okta) — các nút chưa có backend contract đã được loại bỏ.
- Kiểm thử tải cực hạn (stress test hàng triệu concurrent users).

---

## 2. Môi trường & Dữ liệu kiểm thử (Fixture)

### 2.1. Môi trường kiểm thử
- **Môi trường**: Local Development Server (`http://localhost:3000`).
- **Runtime**: Node.js v20+, Next.js 16.3.6 (Turbopack), React 19.
- **Cơ sở dữ liệu**: PostgreSQL (hỗ trợ Supabase qua biến môi trường).

### 2.2. Tài khoản kiểm thử (Test Roles)
| Vai trò | Tài khoản kiểm thử | Quyền hạn chính |
|---|---|---|
| **Quản trị viên (`admin`)** | `admin@example.com` | Toàn quyền cấu hình AI, quản lý người dùng, nhật ký vận hành, kho tri thức, hàng đợi. |
| **Chuyên gia (`technical`)** | `tech@example.com` | Xử lý hàng đợi chuyên gia, xuất bản/gộp tri thức, tra cứu trợ lý, xem nhật ký. |
| **Tư vấn viên (`sales`)** | `sales@example.com` | Sử dụng Trợ lý hỏi đáp, xem hướng dẫn sử dụng, xem hội thoại của chính mình. |

### 2.3. Quy tắc dọn dẹp Fixture an toàn
- Dữ liệu tạo phục vụ test (bài viết thử nghiệm, yêu cầu chuyên gia test, tài khoản test) phải sử dụng tiền tố rõ ràng (ví dụ: `[TEST] Quy trình bảo hành...`).
- Sau khi kiểm thử, sử dụng các API/UI tương ứng để dọn dẹp:
  - Bài viết: Lưu trữ và gọi `DELETE /api/knowledge/articles/:id?permanent=true` kèm `{ "confirm": true }`.
  - Hàng đợi: Xóa ticket test ở trạng thái `new`.
  - Tài khoản test: Vô hiệu hóa hoặc chuyển giao quyền trước khi xóa.

---

## 3. Rủi ro & Chiến lược kiểm soát

| Rủi ro | Mức độ | Biện pháp kiểm soát trong Test Case |
|---|:---:|---|
| **Leo quyền (Privilege Escalation)**: Tài khoản `sales` truy cập API cài đặt hoặc xóa bài | Critical | Kiểm thử truy cập trực tiếp bằng API qua curl/fetch và kiểm tra giao diện ẩn CTA đúng vai trò. |
| **Ảo giác AI (Hallucination)**: Agent tự bịa câu trả lời khi không có bài viết | High | Đặt câu hỏi hoàn toàn không có trong kho tri thức; kỳ vọng hệ thống báo thiếu căn cứ và tạo yêu cầu chuyên gia. |
| **Mất dữ liệu khi xóa bài viết nguồn**: Xóa bài viết làm hỏng trích dẫn trong hội thoại | High | Kiểm tra xóa vĩnh viễn bằng transaction an toàn: làm sạch tham chiếu liên quan nhưng không phá vỡ dữ liệu lịch sử hội thoại. |
| **Đính kèm trùng lặp bản nháp gộp**: Gọi API attach nhiều lần cho cùng 1 ứng viên | Medium | Xác minh mã phản hồi `409 Conflict` khi item không ở trạng thái `candidate/selected/generating/failed`. |
| **Lộ khóa API hoặc mật khẩu**: Ghi log kiểm toán làm lộ bí mật | High | Kiểm tra bảng `operational_logs` và network inspect; bảo đảm API key và mật khẩu không bao giờ xuất hiện. |

---

## 4. Danh mục Test Cases Chi Tiết

### Nhóm 1: Xác thực, Danh tính & Phân quyền RBAC

#### `TC-001`: Giới hạn tần suất đăng nhập sai (Auth Rate Limiting)
- **Mức ưu tiên**: P0 (Critical)
- **Vai trò**: Khách vãng lai (Chưa đăng nhập)
- **Tiền điều kiện**: Ứng dụng đang chạy ở trang `/login`.
- **Dữ liệu**: Nhập email `admin@example.com` với mật khẩu sai liên tiếp 6 lần.
- **Các bước thực hiện**:
  1. Gửi form đăng nhập với mật khẩu sai từ lần 1 đến lần 5.
  2. Gửi tiếp lần thứ 6.
- **Kết quả mong đợi**: Từ lần thứ 6, hệ thống trả về mã `429 Too Many Requests` kèm header `Retry-After`; giao diện hiển thị thông báo an toàn yêu cầu thử lại sau.
- **Dọn dẹp**: Chờ hết thời gian cooldown hoặc chạy `npm run auth-rate-limits:retention`.

#### `TC-002`: Đổi mật khẩu có kiểm tra realtime và xác thực 2FA (TOTP)
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Bất kỳ người dùng (`sales` / `technical` / `admin`)
- **Tiền điều kiện**: Đã đăng nhập vào trang `/profile`.
- **Dữ liệu**: Mật khẩu mới đạt chuẩn (8+ ký tự, có hoa, thường, ký tự đặc biệt).
- **Các bước thực hiện**:
  1. Mở tab Bảo mật, nhập mật khẩu hiện tại và mật khẩu mới.
  2. Quan sát danh sách kiểm tra (checklist) phản hồi realtime theo từng ký tự nhập.
  3. Bấm Kích hoạt 2FA, quét mã QR qua ứng dụng Authenticator, nhập mã OTP 6 số để xác minh.
  4. Đăng xuất và đăng nhập lại bằng mật khẩu mới.
- **Kết quả mong đợi**: Hệ thống yêu cầu bước thử thách 2FA (MFA challenge); chỉ khi nhập đúng mã TOTP mới vào được không gian làm việc.

#### `TC-003`: Kiểm soát phân quyền RBAC trên Sidebar và API
- **Mức ưu tiên**: P0 (Critical)
- **Vai trò**: Đăng nhập lần lượt bằng `sales`, `technical`, `admin`
- **Tiền điều kiện**: Các tài khoản kiểm thử đã sẵn sàng.
- **Các bước thực hiện**:
  1. Đăng nhập bằng `sales`: Kiểm tra Sidebar (chỉ thấy Tổng quan, Hướng dẫn sử dụng, Trợ lý). Cố gắng truy cập URL `/settings` và `/knowledge-base`.
  2. Đăng nhập bằng `technical`: Kiểm tra Sidebar (không thấy Cài đặt).
  3. Dùng session của `sales` gọi API `POST /api/retrieval/settings` hoặc `POST /api/knowledge/articles`.
- **Kết quả mong đợi**: Giao diện điều hướng ẩn các mục không có quyền; truy cập trái phép bị chặn hoặc điều hướng về trang cho phép; API trả về mã lỗi `403 Forbidden`.

#### `TC-004`: Khóa tài khoản (Disable) và Xóa có chỉ định người kế thừa (Successor)
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Quản trị viên (`admin`)
- **Tiền điều kiện**: Có ít nhất 1 tài khoản `technical` có sở hữu bài viết và 1 tài khoản `technical` khác làm người kế thừa.
- **Các bước thực hiện**:
  1. Vào `/settings` tab Người dùng, chọn tài khoản và bấm Khóa tài khoản. Thử đăng nhập bằng tài khoản bị khóa -> xác nhận bị chặn.
  2. Mở khóa lại -> xác nhận đăng nhập bình thường.
  3. Bấm Xóa tài khoản: Modal hiển thị danh sách người kế thừa hợp lệ theo thứ bậc (`sales` → `technical` → `admin`). Chọn người kế thừa và xác nhận xóa.
- **Kết quả mong đợi**: Quyền sở hữu bài viết và phiếu yêu cầu được chuyển giao trọn vẹn cho người kế thừa; tài khoản cũ bị xóa vĩnh viễn thông tin nhạy cảm; không thể xóa tài khoản Admin duy nhất.

---

### Nhóm 2: Trợ lý RAG & Cơ Chế Dự Phòng (Degraded Mode)

#### `TC-005`: Phản hồi có căn cứ và trích dẫn nguồn chuẩn xác
- **Mức ưu tiên**: P0 (Critical)
- **Vai trò**: Tư vấn viên (`sales`)
- **Tiền điều kiện**: Kho tri thức có bài viết đã xuất bản về chủ đề cụ thể (VD: "Quy trình hoàn tiền").
- **Dữ liệu**: Câu hỏi: "Điều kiện để khách hàng được hoàn tiền là gì?"
- **Các bước thực hiện**:
  1. Truy cập `/assistant`, nhập câu hỏi và bấm Gửi.
- **Kết quả mong đợi**: Phản hồi được tạo ra với phong cách trung lập; hiển thị rõ nguồn trích dẫn đính kèm và điểm căn cứ (Grounding Score) an toàn; không xuất hiện yêu cầu chuyên gia.

#### `TC-006`: Tự động tạo Yêu cầu chuyên gia khi thiếu căn cứ
- **Mức ưu tiên**: P0 (Critical)
- **Vai trò**: Tư vấn viên (`sales`)
- **Tiền điều kiện**: Kho tri thức không có bất kỳ tài liệu nào về câu hỏi kiểm thử.
- **Dữ liệu**: Câu hỏi: "Chính sách bảo hành sản phẩm X năm 2035 như thế nào?"
- **Các bước thực hiện**:
  1. Tại `/assistant`, nhập câu hỏi trên và bấm Gửi.
- **Kết quả mong đợi**: Hệ thống không suy đoán; phản hồi thông báo rõ thông tin chưa có trong kho tri thức; tự động tạo một phiếu **Yêu cầu chuyên gia** với mã ticket hiển thị trực tiếp.

#### `TC-007`: Chế độ tra cứu tri thức suy thoái (Degraded Knowledge Mode)
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Quản trị viên (`admin`) và Tư vấn viên (`sales`)
- **Tiền điều kiện**: Tạm thời tắt toàn bộ AI Provider trong `/settings` tab Nhà cung cấp AI.
- **Dữ liệu**: Đặt câu hỏi về nội dung chắc chắn có bài viết trong kho tri thức.
- **Các bước thực hiện**:
  1. Nhân viên gửi câu hỏi trong `/assistant`.
- **Kết quả mong đợi**: Hệ thống không báo lỗi sập ứng dụng; tự động chuyển sang chế độ gợi ý nguồn tri thức đã xác minh; hiển thị các đoạn trích bài viết tương ứng để nhân viên tự đọc.

---

### Nhóm 3: Quản trị Kho Tri thức & Smart Merge Workspace

#### `TC-008`: Nhập dữ liệu theo lô qua Preview Modal (CSV/XLSX)
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Chuyên gia (`technical`) hoặc Quản trị viên (`admin`)
- **Tiền điều kiện**: Đang mở màn hình `/knowledge-base`.
- **Dữ liệu**: Tệp CSV/XLSX mẫu chứa 3 bài viết hợp lệ và 1 dòng thiếu tiêu đề.
- **Các bước thực hiện**:
  1. Bấm nút Nhập tệp (Import) trên thanh công cụ.
  2. Chọn tệp và bấm Xem trước (Preview).
  3. Kiểm tra danh sách hiển thị trong Preview Modal.
  4. Bấm Tiến hành nhập.
- **Kết quả mong đợi**: Preview Modal hiển thị rõ các dòng hợp lệ và cảnh báo dòng không đạt chuẩn; chỉ các dòng hợp lệ được nạp vào cơ sở dữ liệu sau khi bấm xác nhận.

#### `TC-009`: Xóa vĩnh viễn bài viết đã lưu trữ (Permanent Delete)
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Chuyên gia (`technical`) hoặc Quản trị viên (`admin`)
- **Tiền điều kiện**: Có ít nhất 1 bài viết ở trạng thái Lưu trữ (`archived`).
- **Các bước thực hiện**:
  1. Trong tab Đã lưu trữ tại `/knowledge-base`, tìm bài viết test.
  2. Bấm nút Xóa vĩnh viễn. Modal xác nhận yêu cầu nhập đúng từ khóa hoặc xác nhận an toàn.
  3. Xác nhận xóa.
- **Kết quả mong đợi**: Bài viết và toàn bộ chunks bị xóa sạch khỏi cơ sở dữ liệu qua transaction an toàn; các liên kết tham chiếu cũ được dọn dẹp; ghi nhận log kiểm toán thành công.

#### `TC-010`: Trải nghiệm Smart Merge Workspace (KPI Grid, Presets & Diff Modal)
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Chuyên gia (`technical`) hoặc Quản trị viên (`admin`)
- **Tiền điều kiện**: Agent AI đang bật; kho tri thức có ít nhất 2 bài viết có nội dung tương đồng > 70%.
- **Các bước thực hiện**:
  1. Mở tab Gộp bài viết tại `/knowledge-base`.
  2. Kiểm tra hiển thị Bento Header và Bento KPI Grid (4 chỉ số: Ứng viên, Phân tích, Bản nháp, Hợp nhất an toàn).
  3. Bấm vào nút Preset ngưỡng tương đồng (chọn thử lần lượt 65%, 75%, 85%) và quan sát giá trị thanh trượt cập nhật đồng bộ.
  4. Bấm Bắt đầu quét đợt mới. Sau khi có kết quả, bấm Xem đối chiếu tại một cặp ứng viên.
- **Kết quả mong đợi**: Diff Modal mở ra hiển thị đối chiếu 2 cột song song (Bài viết nguồn bên trái và Bản nháp tổng hợp bên phải); hiển thị rõ các thay đổi và nút Phê duyệt / Từ chối.

#### `TC-011`: Ngăn chặn tái đính kèm bản nháp gộp (Server Validation 409)
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Chuyên gia (`technical`) hoặc Quản trị viên (`admin`)
- **Tiền điều kiện**: Một nhóm ứng viên gộp bài đã được xử lý (đã chuyển sang trạng thái `drafted`).
- **Các bước thực hiện**:
  1. Dùng công cụ API gọi lại endpoint `POST /api/knowledge/merge/batches/:id/items/:itemId/attach` với cùng `mergeRunId` cho item đó.
- **Kết quả mong đợi**: Máy chủ từ chối thao tác và trả về mã lỗi `409 Conflict` kèm thông báo an toàn: "Nhóm gộp đã được xử lý hoặc không còn tồn tại."

---

### Nhóm 4: Hàng đợi Chuyên gia & Thẩm định Tri thức

#### `TC-012`: Phân trang và tìm kiếm Server-side trong Hàng đợi
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Chuyên gia (`technical`) hoặc Quản trị viên (`admin`)
- **Tiền điều kiện**: Hàng đợi `/unanswered` có hơn 15 câu hỏi mở.
- **Các bước thực hiện**:
  1. Truy cập `/unanswered`.
  2. Nhập từ khóa tìm kiếm vào ô tra cứu.
  3. Chọn các trang tiếp theo ở thanh phân trang dưới cùng.
- **Kết quả mong đợi**: Kết quả lọc và phân trang được xử lý mượt mà ở máy chủ (`GET /api/unanswered`); danh sách cập nhật chính xác theo từ khóa và trang đã chọn.

#### `TC-013`: Thẩm định câu trả lời bằng Top-Editor và xuất bản tri thức
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Chuyên gia (`technical`) hoặc Quản trị viên (`admin`)
- **Tiền điều kiện**: Có ít nhất 1 yêu cầu chuyên gia đang ở trạng thái `new` hoặc `in_review`.
- **Các bước thực hiện**:
  1. Bấm chọn phiếu trong danh sách.
  2. Quan sát khung Top-Editor mở ra nổi bật ở đầu trang với thông tin câu hỏi và ngữ cảnh.
  3. Nhập nội dung câu trả lời chuẩn hóa và chọn tùy chọn "Xuất bản thành bài viết mới trong Kho tri thức".
  4. Bấm Lưu và hoàn tất.
- **Kết quả mong đợi**: Trạng thái phiếu chuyển thành `published`; một bài viết mới lập tức xuất hiện trong Kho tri thức; lần hỏi sau trong Trợ lý sẽ có căn cứ từ bài viết này.

#### `TC-014`: Xóa an toàn yêu cầu chuyên gia mới chưa qua xử lý
- **Mức ưu tiên**: P2 (Medium)
- **Vai trò**: Chuyên gia (`technical`) hoặc Quản trị viên (`admin`)
- **Tiền điều kiện**: Có một phiếu yêu cầu test ở trạng thái `new` và chưa có lượt review nào.
- **Các bước thực hiện**:
  1. Chọn phiếu test đó trong danh sách `/unanswered`.
  2. Bấm nút Xóa yêu cầu (có biểu tượng thùng rác).
  3. Modal xác nhận xuất hiện, bấm Đồng ý xóa.
- **Kết quả mong đợi**: Phiếu bị xóa vĩnh viễn khỏi hàng đợi; nếu hội thoại gốc đang ở trạng thái `escalated` thì tự động trở về `normal`.

---

### Nhóm 5: Cấu hình, Nhà cung cấp AI & Nhật ký Vận hành

#### `TC-015`: Kích hoạt độc lập AI Provider (Quy tắc Single Active Agent)
- **Mức ưu tiên**: P0 (Critical)
- **Vai trò**: Quản trị viên (`admin`)
- **Tiền điều kiện**: Đã lưu cấu hình hợp lệ cho cả Google Gemini và Azure OpenAI trong `/settings` tab Nhà cung cấp AI.
- **Các bước thực hiện**:
  1. Đang bật Gemini (`isEnabled = true`), bấm Bật cho Azure OpenAI.
  2. Kiểm tra trạng thái của thẻ Gemini.
  3. Tải lại trang (F5) để kiểm tra tính nhất quán dữ liệu từ cơ sở dữ liệu.
- **Kết quả mong đợi**: Azure chuyển sang trạng thái Đang hoạt động; Gemini tự động chuyển về trạng thái Tắt; database đảm bảo chỉ duy nhất một provider được bật.

#### `TC-016`: Lọc thời gian và phân trang Nhật ký vận hành (Operational Logs)
- **Mức ưu tiên**: P1 (High)
- **Vai trò**: Quản trị viên (`admin`)
- **Tiền điều kiện**: Đã phát sinh một số hoạt động đăng nhập, tạo bài viết và cấu hình để có dữ liệu log.
- **Các bước thực hiện**:
  1. Vào `/settings` tab Nhật ký vận hành.
  2. Chọn lọc theo Danh mục (ví dụ: `authentication`).
  3. Chọn khoảng thời gian Từ ngày - Đến ngày theo múi giờ Việt Nam.
  4. Bấm Áp dụng bộ lọc và duyệt qua các trang phân trang.
- **Kết quả mong đợi**: Bảng nhật ký hiển thị chính xác các sự kiện thuộc danh mục và khoảng thời gian đã chọn; kiểm tra kỹ đảm bảo tuyệt đối không có mật khẩu, token hay nội dung chat trong chi tiết log.

---

### Nhóm 6: Giao diện Modern Bento Layout & Tương tác UI/UX

#### `TC-017`: Kiểm tra nền Ambient Aurora & Thanh điều hướng Frosted Glass
- **Mức ưu tiên**: P2 (Medium)
- **Vai trò**: Mọi vai trò người dùng
- **Tiền điều kiện**: Đã đăng nhập vào bất kỳ màn hình nào.
- **Các bước thực hiện**:
  1. Quan sát màu nền ứng dụng toàn màn hình (`.bento-shell`).
  2. Quan sát hiệu ứng của thanh Sidebar bên trái và Topbar phía trên khi cuộn trang nội dung.
- **Kết quả mong đợi**: Nền hiển thị dải chuyển màu Ambient Aurora Mesh Gradient tinh tế, có chiều sâu không gian; Sidebar và Topbar áp dụng hiệu ứng kính mờ (Frosted Glass) nhìn thấy vệt màu aurora nhẹ phía sau; không bị giật lag hay vỡ layout.

#### `TC-018`: Kiểm tra Bento Icon Badge Tiles và trạng thái Hover/Active
- **Mức ưu tiên**: P2 (Medium)
- **Vai trò**: Mọi vai trò người dùng
- **Tiền điều kiện**: Đang ở màn hình bất kỳ.
- **Các bước thực hiện**:
  1. Rà chuột (hover) qua lần lượt từng mục menu ở Sidebar: Tổng quan, Hướng dẫn sử dụng, Trợ lý, Hội thoại, Kho kiến thức, Yêu cầu chuyên gia, Cài đặt.
  2. Bấm chuyển trang và quan sát mục đang kích hoạt (active).
- **Kết quả mong đợi**: Mỗi icon nằm trong hộp badge tile 32x32px với màu sắc nhận diện danh mục riêng biệt (Indigo, Amber, Sky, Purple, Emerald, Rose, Slate); khi hover badge nổi nhẹ; khi active badge chuyển sang dải gradient 3D nổi bật kèm thanh chỉ thị phát sáng ở cạnh trái.

#### `TC-019`: Kiểm tra hệ thống nhãn Eyebrow & Subtitle nghiệp vụ trên 9 màn hình
- **Mức ưu tiên**: P2 (Medium)
- **Vai trò**: Quản trị viên (`admin`)
- **Tiền điều kiện**: Đã đăng nhập.
- **Các bước thực hiện**:
  1. Duyệt qua lần lượt toàn bộ 9 màn hình: `/`, `/guide`, `/assistant`, `/conversations`, `/knowledge-base`, `/unanswered`, `/review`, `/settings`, `/profile`.
  2. Kiểm tra phần tiêu đề (Header) của từng trang.
- **Kết quả mong đợi**: Toàn bộ 9 màn hình hiển thị nhãn Eyebrow nghiệp vụ chuyên nghiệp (không còn lặp breadcrumb `KHÔNG GIAN LÀM VIỆC / ...`); tiêu đề H1 và mô tả phụ nhất quán theo hệ thống Bento Design System.

#### `TC-020`: Kiểm tra chuẩn mực tương tác Modal (No Browser Alerts)
- **Mức ưu tiên**: P0 (Critical)
- **Vai trò**: Mọi vai trò người dùng
- **Tiền điều kiện**: Đang mở các chức năng có thao tác xác nhận (Đăng xuất, Xóa bài viết, Phê duyệt gộp, Nhập tệp).
- **Các bước thực hiện**:
  1. Bấm nút kích hoạt thao tác (ví dụ: Đăng xuất từ menu tài khoản).
  2. Thử nhấn phím `Escape`.
  3. Thử nhấp chuột ra vùng mờ bên ngoài (backdrop click).
  4. Quan sát các thông báo phản hồi khi thành công hoặc thất bại.
- **Kết quả mong đợi**: 100% thao tác sử dụng Custom Dialog / Modal / Toast component; tuyệt đối không có bất kỳ cửa sổ mặc định nào của trình duyệt như `alert()`, `confirm()`, `prompt()`. Phím Esc và click backdrop đóng modal an toàn.

---

## 5. Tiêu chí Phát hành (Release Criteria)

Ứng dụng chỉ đủ điều kiện phát hành khi thỏa mãn đầy đủ các tiêu chuẩn sau:
1. **Tỷ lệ vượt qua Test Case**:
   - 100% các Test Case mức **P0 (Critical)** phải đạt trạng thái `PASS`.
   - 100% các Test Case mức **P1 (High)** phải đạt trạng thái `PASS`.
   - Các Test Case mức **P2 (Medium)** đạt tỷ lệ tối thiểu 90% (các trường hợp chưa đạt phải có giải pháp khắc phục tạm thời được ghi nhận).
2. **Không tồn đọng lỗi nghiêm trọng**:
   - 0 lỗi Severity `Critical` hoặc `High`.
3. **Biên dịch & Kiểu dữ liệu**:
   - Lệnh `npm run build` và `npm run typecheck` hoàn tất thành công (exit code 0, không có cảnh báo nghiêm trọng).
4. **Bảo mật & Biến môi trường**:
   - Không có API key, secret, mật khẩu hay token nào bị hardcode hoặc log ra client.
   - Tài liệu API [docs/API.md](file:///d:/Project/support-reply-assistant/docs/API.md) và tài liệu kiến trúc [docs/memory/plans/CONSOLIDATED-PLANS.md](file:///d:/Project/support-reply-assistant/docs/memory/plans/CONSOLIDATED-PLANS.md) được cập nhật đồng bộ.

---

## 6. Trách nhiệm & Bước tiếp theo

- **Thực thi kiểm thử (QC Run)**: Kế hoạch này là đầu vào trực tiếp cho kỹ năng **/my-qc**. Khi người dùng yêu cầu kiểm tra thực tế, lệnh `/my-qc` sẽ chạy từng kịch bản kiểm thử, chụp bằng chứng và ghi nhận báo cáo chi tiết tại `docs/QC-REPORT-YYYY-MM-DD.md`.
- **Khắc phục lỗi (QF)**: Các lỗi phát hiện trong quá trình kiểm thử sẽ được gắn mã định danh (`QC-001`, `QC-002`, ...) và chuyển giao cho quy trình **/my-qf** để khắc phục có kiểm chứng.
