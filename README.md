# Trợ lý phản hồi (Support Reply Assistant)

> **Hệ thống Trợ lý Tri thức Khách hàng Mã nguồn mở Cấp Doanh nghiệp**  
> Tự chủ hạ tầng tri thức, loại bỏ hoàn toàn ảo giác AI (Anti-Hallucination) bằng cơ chế đối soát căn cứ đa tầng (Grounded RAG), đặt con người vào trung tâm quyết định (Human-in-the-Loop) và tuân thủ các tiêu chuẩn bảo mật nghiêm ngặt nhất.

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Security Audit](https://img.shields.io/badge/Security%20Audit-Verified%20Clean-success?style=flat-square)](docs/SECURITY-REPORT-2026-09-30.md)
[![License](https://img.shields.io/badge/License-Open%20Source-green?style=flat-square)](#minh-bạch-mã-nguồn-mở--cam-kết-quyền-riêng-tư)

---

## 1. Giới thiệu tổng quan & Sứ mệnh

Trong hoạt động chăm sóc khách hàng và vận hành doanh nghiệp, việc ứng dụng AI tạo sinh (Generative AI) thường vấp phải rào cản lớn nhất: **AI tự suy đoán nội dung (Hallucination)**, dẫn đến việc tư vấn sai chính sách, sai giá hoặc cam kết vượt thẩm quyền. Đồng thời, việc đưa dữ liệu khách hàng lên các nền tảng đám mây đóng kín tiềm ẩn nguy cơ rò rỉ dữ liệu nội bộ nghiêm trọng.

**Trợ lý phản hồi (Support Reply Assistant)** được thiết kế để giải quyết triệt để bài toán này:
- **Không suy đoán bừa bãi:** AI chỉ được phép tổng hợp câu trả lời khi tìm thấy đầy đủ tài liệu căn cứ hợp lệ đã được thẩm định trong Kho tri thức.
- **Minh bạch nguồn gốc:** Mọi phản hồi đều hiển thị rõ ràng nguồn trích dẫn, liên kết bài viết và Điểm căn cứ định lượng (Grounded Confidence Score).
- **Chuyển giao thông minh (Graceful Escalation):** Khi tri thức chưa đủ hoặc câu hỏi chạm đến các chủ đề nhạy cảm (Giá, Hợp đồng, SLA, Bảo mật), hệ thống tự động chuyển tiếp câu hỏi thành **Yêu cầu chuyên gia** kèm phân tích lý do cụ thể, thay vì để nhân viên tư vấn sai hoặc câu hỏi bị lãng quên.
- **Khép kín vòng đời tri thức:** Câu trả lời do chuyên gia giải đáp được biên tập và xuất bản trực tiếp thành bài viết mới trong Kho tri thức, giúp toàn bộ đội ngũ tự động học hỏi và tái sử dụng ở các tình huống tiếp theo.

---

## 2. Ứng dụng mang lại giá trị gì cho tổ chức?

| Nhóm người dùng | Giá trị thực tiễn mang lại |
| :--- | :--- |
| **Nhân viên tư vấn (Sales / Support)** | <ul><li>Rút ngắn 80% thời gian tra cứu tài liệu nội bộ giữa hàng trăm quy trình phức tạp.</li><li>Tự tin tư vấn nhờ có nguồn trích dẫn đối soát chính thức ngay bên cạnh câu trả lời.</li><li>Biết chính xác khi nào cần xin ý kiến chuyên gia thay vì phỏng đoán mạo hiểm.</li></ul> |
| **Chuyên gia nghiệp vụ (Technical / QA / Reviewer)** | <ul><li>Kiểm soát hàng đợi các khoảng trống tri thức (Knowledge Gaps) phát sinh từ thực tế.</li><li>Thẩm định câu trả lời một lần và xuất bản thành tài sản tri thức dùng chung cho toàn công ty.</li><li>Hợp nhất bài viết trùng lặp thông minh (Smart Merge) để giữ kho dữ liệu luôn tinh gọn.</li></ul> |
| **Quản trị viên & Trưởng phòng CSKH (Admin / Operations)** | <ul><li>Kiểm soát chi phí và linh hoạt chuyển đổi giữa Google Gemini và Azure OpenAI theo nhu cầu.</li><li>Tùy chỉnh ngưỡng an toàn, chủ đề nhạy cảm và phong cách diễn đạt của Trợ lý AI.</li><li>Theo dõi toàn diện nhật ký vận hành (Audit Logs) và bảo vệ an toàn dữ liệu nội bộ.</li></ul> |

---

## 3. Minh bạch Mã nguồn Mở & Cam kết Quyền riêng tư

Là một dự án mã nguồn mở hướng tới môi trường doanh nghiệp, **Trợ lý phản hồi** cam kết minh bạch 100% về mặt công nghệ và quản trị dữ liệu:

1. **Tự chủ hạ tầng 100% (Self-Hosted / On-Premise):**
   - Ứng dụng chạy hoàn toàn trên máy chủ riêng hoặc hạ tầng đám mây nội bộ của doanh nghiệp. Bạn sở hữu toàn bộ cơ sở dữ liệu PostgreSQL, không bị khóa vào bất kỳ nhà cung cấp dịch vụ thứ ba nào (No Vendor Lock-in).
2. **Bảo vệ quyền riêng tư & Dữ liệu khách hàng:**
   - Dữ liệu câu hỏi, lịch sử hội thoại nội bộ và thông tin người dùng **tuyệt đối không bị chia sẻ** cho bên ngoài và không bị dùng để đào tạo (train) lại các mô hình AI công cộng.
3. **Mã hóa cấp quân sự (AES-256-GCM AEAD):**
   - Khóa API của nhà cung cấp AI và mật khẩu máy chủ SMTP được mã hóa an toàn khi lưu trữ tại máy chủ (Encryption at Rest) bằng khóa bí mật `SECRETS_ENCRYPTION_KEY`. Các khóa này không bao giờ được gửi về trình duyệt hay xuất hiện trong API response.
4. **Kiểm toán bảo mật độc lập định kỳ:**
   - Mã nguồn được rà soát định kỳ theo quy chuẩn bảo mật nghiêm ngặt (kiểm tra injection, session revocation, rate-limiting, SSRF, DNS rebinding, dependency vulnerabilities). Toàn bộ báo cáo kiểm định được công khai minh bạch tại thư mục [`docs/`](docs/).

---

## 4. Kiến trúc Hệ thống & Luồng RAG Đối soát

```text
               ┌────────────────────────────────────────────────────────┐
               │         Người dùng đặt câu hỏi trong Trợ lý             │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │    Truy xuất Kho tri thức (Hybrid Search: Vector + BM25)│
               │   Lọc tài liệu: Còn hiệu lực, Đã xác minh, Đúng nhóm   │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │     Đánh giá Điểm căn cứ & Kiểm tra Chủ đề nhạy cảm    │
               │   (Grounded Score vs Ngưỡng an toàn Auto-Answer/Escalate)│
               └───────────────────────────┬────────────────────────────┘
                                           │
                 ┌─────────────────────────┴─────────────────────────┐
                 │                                                   │
     [ Đủ căn cứ & An toàn ]                             [ Thiếu căn cứ / Nhạy cảm ]
                 │                                                   │
                 ▼                                                   ▼
┌───────────────────────────────────┐               ┌───────────────────────────────────┐
│     Agent tổng hợp câu trả lời    │               │  Tự động tạo Yêu cầu chuyên gia   │
│  - Trích dẫn nguồn bài viết rõ ràng│               │  - Nêu rõ lý do thiếu tài liệu    │
│  - Giọng điệu chuẩn hóa doanh nghiệp│              │  - Thông báo nhân viên chờ xác nhận│
└───────────────────────────────────┘               └─────────────────┬─────────────────┘
                                                                      │
                                                                      ▼
                                                    ┌───────────────────────────────────┐
                                                    │   Chuyên gia giải đáp & Xuất bản  │
                                                    │   - Tri thức mới lưu vào Kho       │
                                                    │   - Vòng hỏi sau được tự động trả lời│
                                                    └───────────────────────────────────┘
```

### Điểm căn cứ (Grounded Confidence Score) hoạt động như thế nào?
Điểm căn cứ được tính toán dựa trên sự kết hợp có trọng số của 3 yếu tố:
- **Độ khớp từ khóa & ngữ nghĩa (Keyword & Semantic Relevance):** Đảm bảo bài viết đúng thuật ngữ và sát nghĩa ngữ cảnh câu hỏi.
- **Tính đa dạng & Chất lượng nguồn (Source Diversity & Priority):** Ưu tiên các tài liệu được đánh dấu là *Chính sách chuẩn*, *Nguồn đã xác minh* và còn hạn hiệu lực.
- **Bộ lọc chủ đề nhạy cảm (Sensitive Topic Guard):** Nếu câu hỏi chứa các chủ đề thuộc diện kiểm soát đặc biệt (ví dụ: *Giá, Hợp đồng, SLA, Bảo mật*), hệ thống nâng ngưỡng an toàn lên mức tối đa hoặc chủ động điều hướng sang chuyên gia dù đã tìm thấy tài liệu tham khảo.

### Khả năng tự phục hồi khi Agent ngoại tuyến (Fail-safe Architecture)
Nếu nhà cung cấp AI gặp sự cố gián đoạn hoặc hết quota, hệ thống **không bị tê liệt**:
- Cơ chế tìm kiếm tri thức cơ sở dữ liệu vẫn hoạt động bình thường.
- Nếu điểm căn cứ đạt mức an toàn, hệ thống lập tức chuyển sang chế độ **Gợi ý trích dẫn tri thức (Knowledge Suggestions)**: hiển thị trực tiếp các đoạn trích từ bài viết đã thẩm định cho nhân viên tư vấn, tuyệt đối không tự bịa đặt câu trả lời.

---

## 5. Bản đồ Tính năng & Giao diện Bento Design System

Ứng dụng được xây dựng trên ngôn ngữ thiết kế **Modern Bento UI** cao cấp, kết hợp nền *Ambient Aurora Mesh Gradient*, hiệu ứng kính mờ *Frosted Glass*, phân lớp bóng đổ tinh tế và typography hiện đại:

| Tính năng | Mô tả chi tiết & Điểm nổi bật |
| :--- | :--- |
| **Tổng quan (Bento Dashboard)** | Bảng điều khiển tập trung hiển thị các chỉ số vận hành then chốt: Tỷ lệ trả lời tự động, Yêu cầu chuyên gia chờ duyệt, Radar đối soát RAG và danh sách công việc cần ưu tiên. |
| **Trợ lý AI (Support Assistant)** | Giao diện hội thoại thông minh hỗ trợ streaming phản hồi, hiển thị thẻ trích dẫn nguồn có thể mở đọc trực tiếp, chỉ báo trạng thái đối soát RAG và cơ chế chuyển tiếp chuyên gia 1-click. |
| **Kho tri thức (Knowledge Base)** | Quản lý toàn diện tài liệu Markdown nội bộ, tự động chia nhỏ thành các phân mảnh ngữ nghĩa (Semantic Chunks) kèm tìm kiếm toàn văn GIN/Vector; hỗ trợ nhập hàng loạt bằng Excel/CSV (.xlsx, .csv). |
| **Gộp bài viết (Smart Merge)** | Tính năng độc quyền quét toàn bộ kho tri thức để phát hiện bài viết trùng lặp nội dung theo đợt; cung cấp giao diện đối chiếu 2 cột (Diff Viewer) giúp chuyên gia hợp nhất bài viết mà không làm mất thông tin gốc. |
| **Hàng đợi chuyên gia (Expert Queue)** | Quản lý các câu hỏi chưa được giải đáp trong thực tế; chuyên gia tiếp nhận, thẩm định nội dung, phản hồi khách hàng và xuất bản thẳng thành bài viết tri thức mới chỉ bằng 1 thao tác. |
| **Thành phần Bento độc quyền** | <ul><li>**`BentoSelect`**: Dropdown menu bo góc tròn, hiệu ứng kính mờ, tự động tính toán hướng mở (dropup/dropdown) chống che khuất và quản lý tầng hiển thị `z-index` thông minh.</li><li>**`BentoDatePicker`**: Bộ chọn lịch tiếng Việt thuần túy thay thế lịch thô của trình duyệt, hiển thị trực quan định dạng `DD/MM/YYYY`, tích hợp phím tắt hôm nay/xóa nhanh.</li></ul> |
| **Quản trị người dùng & Phân quyền (RBAC)** | Phân quyền 3 cấp độ chặt chẽ (*Sales - Tư vấn viên*, *Technical - Chuyên gia kiểm định*, *Admin - Quản trị viên*); cơ chế chuyển giao dữ liệu bắt buộc (Successor Hierarchy) khi xóa tài khoản để không làm thất thoát tri thức. |
| **Bảo mật mật khẩu & Xác thực 2 bước (2FA)** | Bộ kiểm tra độ mạnh mật khẩu chuẩn doanh nghiệp (Checklist thời gian thực); tích hợp xác thực 2 bước qua ứng dụng Authenticator (Google Authenticator, Microsoft Authenticator) bằng chuẩn TOTP RFC 6238. |
| **Khôi phục mật khẩu an toàn & Quản trị SMTP** | Quản trị viên cấu hình kết nối SMTP máy chủ gửi thư (Gmail App Password hoặc SMTP Server); quy trình quên mật khẩu gửi mã OTP 6 số qua email có bảo vệ chống brute-force và thu hồi phiên toàn diện. |
| **Nhật ký vận hành & Xuất báo cáo Excel** | Ghi nhận chi tiết mọi biến động hệ thống (đăng nhập, đổi quyền, thay đổi cấu hình, xóa bài viết); hỗ trợ lọc theo ngày giờ Việt Nam và xuất tệp Excel (.xlsx) chuyên nghiệp phục vụ kiểm toán nội bộ. |

---

## 6. Cấu trúc Mã nguồn Minh bạch (Repository Structure)

Cấu trúc dự án được phân tách rõ ràng theo chuẩn kiến trúc Next.js App Router, giúp các kỹ sư và chuyên gia bảo mật dễ dàng thẩm định và đóng góp mã nguồn:

```text
support-reply-assistant/
├── app/                           # Lớp định tuyến & API Routes (Next.js App Router)
│   ├── (screens)/                 # Các trang giao diện chính (assistant, knowledge, review...)
│   ├── api/                       # Toàn bộ REST API Endpoints được kiểm soát RBAC
│   │   ├── assistant/             # API xử lý câu hỏi & sinh câu trả lời RAG
│   │   ├── auth/                  # Đăng nhập, đăng xuất, MFA TOTP & Quên mật khẩu OTP
│   │   ├── knowledge/             # Quản lý bài viết, nhập file, gộp tri thức Smart Merge
│   │   ├── operational-logs/      # Tra cứu và xuất báo cáo nhật ký vận hành (.xlsx)
│   │   ├── providers/             # Quản lý cấu hình Gemini & Azure OpenAI
│   │   ├── settings/              # Cấu hình SMTP gửi thư & tham số hệ thống
│   │   └── users/                 # Quản trị tài khoản, phân quyền, bàn giao & xóa
│   ├── bento-layout.css           # Hệ thống CSS Design Tokens & Bento UI Components
│   └── ui-components.css          # Thư viện kiểu dáng giao diện dùng chung
├── components/                    # Thành phần giao diện React có tính tái sử dụng cao
│   ├── screens/                   # Giao diện hoàn chỉnh từng phân hệ nghiệp vụ
│   └── ui/                        # Nguyên tử giao diện Bento (Button, Modal, BentoSelect, BentoDatePicker...)
├── lib/                           # Tầng xử lý nghiệp vụ lõi (Core Business Logic)
│   ├── ai/                        # Kết nối LLM (Gemini / Azure OpenAI), prompt engineering & guardrails
│   ├── auth/                      # Quản lý phiên JWT, băm mật khẩu, TOTP & OTP reset token
│   ├── db/                        # Kết nối PostgreSQL connection pool & transaction helper
│   ├── retrieval/                 # Thuật toán tìm kiếm tri thức lai (Hybrid Search) & chấm điểm căn cứ
│   └── security/                  # Mã hóa AES-256-GCM, Rate Limiting 3 tầng & kiểm tra bảo mật mạng
├── db/                            # Cơ sở dữ liệu
│   └── schema.sql                 # Lược đồ cơ sở dữ liệu quan hệ hoàn chỉnh
├── scripts/                       # Kịch bản dòng lệnh vận hành & Bảo trì
│   ├── migrate.ts                 # Trình di chuyển dữ liệu Idempotent Migration
│   ├── seed.ts                    # Khởi tạo dữ liệu mẫu cho môi trường phát triển
│   ├── retention.ts               # Dọn dẹp hội thoại cũ định kỳ (Conversations retention)
│   ├── operational-log-retention.ts # Dọn dẹp nhật ký vận hành theo hạn lưu trữ
│   ├── auth-rate-limit-retention.ts # Giải phóng bộ nhớ bucket rate-limit quá hạn
│   └── password-reset-retention.ts  # Làm sạch các yêu cầu OTP hết hạn (> 30 ngày)
└── docs/                          # Tài liệu kỹ thuật chi tiết
    ├── API.md                     # Hợp đồng chi tiết toàn bộ API Endpoints
    ├── DEPLOYMENT.md              # Hướng dẫn đóng gói Docker & Triển khai Production
    └── SECURITY-REPORT-*.md       # Lịch sử các báo cáo kiểm định bảo mật định kỳ
```

---

## 7. Tiêu chuẩn Bảo mật Cấp Doanh nghiệp (Enterprise Security)

| Cơ chế bảo vệ | Cách thức triển khai trong mã nguồn |
| :--- | :--- |
| **Quản lý phiên (Session Security)** | Phiên đăng nhập lưu trong Cookie `httpOnly`, `SameSite=Lax`, `Secure`. Khi người dùng đổi mật khẩu, bị vô hiệu hóa hoặc đổi 2FA, trường `session_version` trong database tự động tăng để **thu hồi ngay lập tức toàn bộ phiên cũ** trên mọi thiết bị. |
| **Chống Brute-Force & DoS đa tầng** | Cơ chế Rate Limiting phân lớp lưu trực tiếp trong PostgreSQL (đồng bộ trên toàn bộ cụm máy chủ): kiểm soát lưu lượng toàn cục (`global`), kiểm soát theo địa chỉ IP (`client_ip`) và kiểm soát theo định danh tài khoản (`identity`). Trả về mã lỗi chuẩn `429 Too Many Requests` kèm `Retry-After`. |
| **Bảo mật luồng Quên mật khẩu** | Mã OTP 6 chữ số được băm HMAC-SHA256 trước khi lưu; đối soát bằng thuật toán `timingSafeEqual` chống tấn công đo thời gian (Timing Attack); khóa hàng `SELECT ... FOR UPDATE` triệt tiêu race condition; yêu cầu mã mới tự động vô hiệu hóa mã cũ. |
| **Phòng chống SSRF & DNS Rebinding** | Khi cấu hình hoặc kiểm tra máy chủ gửi thư SMTP, hệ thống chủ động phân giải DNS (`dns.promises.lookup`) và từ chối kết nối tới toàn bộ dải IP riêng tư (Private IP RFC 1918), Loopback (`127.0.0.1`), Link-Local (`169.254.x.x`) hoặc tên miền nội bộ. |
| **Làm sạch tệp tải lên (File Sanitization)** | Ảnh đại diện (Avatar) chỉ cho phép định dạng ảnh hợp lệ, giới hạn 5 MB, được giải mã và chuẩn hóa lại thành định dạng WebP an toàn trước khi ghi vào thư mục lưu trữ ngoài web root; tệp nhập dữ liệu chỉ nhận văn bản thuần qua thư viện an toàn `exceljs`. |
| **Bảo vệ chống rò rỉ dữ liệu trong Log** | Nhật ký vận hành (Operational Logs) tuyệt đối không ghi nội dung chat, mật khẩu, khóa API, mã OTP hay địa chỉ email nhận thư test. |

---

## 8. Hướng dẫn Cài đặt & Triển khai Nhanh

### Yêu cầu hệ thống
- **Node.js**: Phiên bản 20.x hoặc 22.x LTS trở lên
- **PostgreSQL**: Phiên bản 16 trở lên (khuyến nghị có extension `pgvector` để tối ưu hóa tìm kiếm vector)
- **Docker & Docker Compose** (nếu muốn khởi chạy database nhanh trong môi trường local)

### Bước 1: Clone mã nguồn & Cài đặt thư viện
```bash
git clone https://github.com/your-org/support-reply-assistant.git
cd support-reply-assistant
npm install
```

### Bước 2: Thiết lập biến môi trường
Tạo tệp `.env` từ tệp mẫu `.env.example`:
```bash
cp .env.example .env
```
Cập nhật các thông số thiết yếu trong `.env`:
```env
# Kết nối cơ sở dữ liệu PostgreSQL
DATABASE_URL=postgresql://@localhost:5432/support_reply_assistant

# Khóa bí mật JWT Session (chuỗi ngẫu nhiên dài tối thiểu 32 ký tự)
AUTH_SECRET=your_super_secret_auth_key_at_least_32_characters

# Khóa mã hóa AES-256-GCM bảo vệ API Key & SMTP (32 bytes base64)
# Bạn có thể tạo nhanh bằng lệnh: node -e "console.log(crypto.randomBytes(32).toString('base64'))"
SECRETS_ENCRYPTION_KEY=your_base64_encoded_32_byte_encryption_key

# URL ứng dụng
APP_URL=http://localhost:3000

# Bật 'true' nếu ứng dụng chạy sau Reverse Proxy tin cậy (Nginx, Traefik, Cloudflare)
TRUST_PROXY=false
```

### Bước 3: Khởi động cơ sở dữ liệu & Chạy Migration
Nếu sử dụng Docker Compose:
```bash
# Khởi động PostgreSQL 16 + pgvector container
npm run db:up

# Chạy di chuyển cấu trúc dữ liệu tự động (Idempotent Migration)
npm run db:migrate

# (Tùy chọn) Khởi tạo dữ liệu mẫu ban đầu để kiểm thử
npm run db:seed
```

### Bước 4: Khởi chạy ứng dụng
Chạy trong môi trường phát triển (Development):
```bash
npm run dev
```
Mở trình duyệt tại địa chỉ `http://localhost:3000`.

Tài khoản quản trị mặc định (nếu chạy seed):
- **Email:** `admin@support.local`
- **Mật khẩu:** `Admin@123456` *(Bắt buộc đổi mật khẩu ngay sau lần đăng nhập đầu tiên)*

---

### Bước 5: Triển khai Production & Tác vụ Bảo trì định kỳ

Khi triển khai trên máy chủ thực tế (Production), thực hiện biên dịch gói tối ưu:
```bash
npm run build
npm run deploy:start
```

Để giữ hệ thống luôn sạch sẽ và tối ưu hiệu năng cơ sở dữ liệu, hãy thiết lập **Cron Job** chạy định kỳ các tác vụ dọn dẹp dữ liệu quá hạn:
```bash
# Dọn dẹp lịch sử hội thoại cũ hơn 90 ngày (Chạy hàng ngày)
npm run conversations:retention -- --apply

# Dọn dẹp nhật ký vận hành quá hạn do Admin cấu hình (Chạy hàng ngày)
npm run operational-logs:retention -- --apply

# Giải phóng bộ nhớ bucket rate-limit quá hạn (Chạy hàng ngày)
npm run auth-rate-limits:retention -- --apply

# Xóa các yêu cầu đặt lại mật khẩu OTP đã hết hạn hoặc tiêu thụ quá 30 ngày (Chạy hàng ngày)
npm run password-resets:retention -- --apply
```

---

## 9. Tài liệu Kỹ thuật Chi tiết

- 📘 [Hợp đồng Toàn bộ API Endpoints (docs/API.md)](docs/API.md) — Chi tiết tham số, cấu trúc request/response và mã lỗi.
- 🚀 [Hướng dẫn Đóng gói & Triển khai Production (docs/DEPLOYMENT.md)](docs/DEPLOYMENT.md) — Hướng dẫn Docker, biến môi trường và thiết lập Reverse Proxy.
- 🛡️ [Báo cáo Kiểm định Bảo mật Mới nhất (2026-09-30)](docs/SECURITY-REPORT-2026-09-30.md) — Kiểm định chuyên sâu chức năng Quên mật khẩu OTP & Cấu hình SMTP.
- 🛡️ [Báo cáo Kiểm định Bảo mật (2026-09-29)](docs/SECURITY-REPORT-2026-09-29.md) — Kiểm tra rate limiting, ExcelJS dependency & RBAC.
- 🛡️ [Báo cáo Kiểm định Bảo mật (2026-09-28)](docs/SECURITY-REPORT-2026-09-28.md) — Kiểm định toàn diện kiến trúc bảo mật nền tảng.

---

## 10. Giấy phép Bản quyền (License)

Dự án được phát hành dưới hình thức **Mã nguồn mở (Open Source)**. Mọi cá nhân và tổ chức đều có quyền tự do triển khai, tùy biến và sử dụng trong nội bộ doanh nghiệp.
