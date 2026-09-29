# Trợ lý phản hồi

**Trợ lý phản hồi** là ứng dụng hỗ trợ đội ngũ chăm sóc khách hàng tra cứu, kiểm chứng và sử dụng tri thức nội bộ khi tư vấn. Ứng dụng không hướng đến việc trả lời thay con người bằng nội dung suy đoán; mục tiêu là giúp mỗi phản hồi có căn cứ, minh bạch nguồn tham khảo và được chuyển đúng người khi hệ thống chưa đủ điều kiện trả lời an toàn.

## Ứng dụng dành cho ai?

| Nhóm người dùng | Giá trị chính |
| --- | --- |
| **Nhân viên tư vấn** | Đặt câu hỏi về tình huống khách hàng, nhận phản hồi có nguồn tham khảo và biết rõ khi nào cần chờ chuyên gia. |
| **Chuyên gia nghiệp vụ/kỹ thuật** | Xử lý yêu cầu cần xác nhận, chuẩn hóa câu trả lời và bổ sung tri thức dùng lại cho toàn đội ngũ. |
| **Quản trị viên** | Quản lý Agent, chính sách truy xuất, Kho tri thức, người dùng và các nguyên tắc vận hành an toàn. |

## Giá trị mang lại

- Rút ngắn thời gian tìm kiếm tài liệu nội bộ khi hỗ trợ khách hàng.
- Hạn chế phản hồi thiếu căn cứ nhờ cơ chế đánh giá nguồn và ngưỡng an toàn.
- Đưa các khoảng trống tri thức đến đúng chuyên gia thay vì để câu hỏi bị bỏ quên.
- Biến câu trả lời đã xác nhận thành tri thức có thể tái sử dụng ở các tình huống sau.
- Giữ trách nhiệm quyết định ở con người: nhân viên luôn nhìn thấy nguồn và mức căn cứ trước khi tư vấn.

## Các chức năng chính

| Chức năng | Công dụng |
| --- | --- |
| **Tổng quan** | Theo dõi tình hình vận hành tri thức, các chỉ số phản hồi và công việc cần ưu tiên. |
| **Hướng dẫn sử dụng** | Giải thích theo vai trò về luồng Agent, điểm căn cứ, yêu cầu chuyên gia, gộp bài viết và ý nghĩa từng cấu hình. |
| **Trợ lý** | Tiếp nhận câu hỏi, tìm nguồn trong Kho tri thức và trình bày phản hồi phù hợp với căn cứ hiện có. |
| **Hội thoại** | Lưu và tra cứu lịch sử trao đổi theo thứ tự ổn định; dữ liệu được giữ mặc định 90 ngày. |
| **Kho tri thức** | Tạo, nhập, chỉnh sửa, xuất bản, lưu trữ, khôi phục hoặc xóa vĩnh viễn tài liệu văn bản đã lưu trữ; chỉ nội dung phù hợp chính sách mới được dùng để tra cứu. |
| **Gộp bài viết (Smart Merge)** | Phát hiện bài viết tương đồng theo đợt với giao diện Modern Bento: hiển thị chỉ số quét trực quan (KPI Grid), bộ chọn nhanh ngưỡng (65%/75%/85%), danh sách đề xuất kèm tiêu đề tài liệu nguồn và Modal đối chiếu 2 cột trước khi phê duyệt. |
| **Yêu cầu chuyên gia** | Là hàng đợi các câu hỏi chưa xử lý xong; yêu cầu đã xuất bản hoặc đóng không còn hiện trong danh sách cần xử lý. Có tìm kiếm, phân trang và liên kết trực tiếp đến yêu cầu đang chọn. |
| **Cài đặt** | Cấu hình cách Agent diễn đạt, nguồn/cách xếp hạng tri thức, ngưỡng phản hồi, chủ đề nhạy cảm, nhà cung cấp AI và người dùng. |
| **Thông tin người dùng** | Cho phép người dùng đổi mật khẩu, quản lý xác thực hai bước và ảnh đại diện của chính mình. |

## Cách hệ thống xử lý một câu hỏi

```text
Người dùng đặt câu hỏi
        ↓
Tìm kiếm trong Kho tri thức đã xuất bản
        ↓
Đánh giá căn cứ, chính sách nguồn và ngưỡng an toàn
        ↓
┌──────────────────────────────────────────────────────────────────┐
│ Đủ điều kiện: Agent tổng hợp phản hồi kèm nguồn tham khảo.        │
│ Chưa đủ điều kiện: tạo Yêu cầu chuyên gia và nêu lý do cụ thể.    │
│ Agent không sẵn sàng: trả gợi ý từ nguồn đã xác minh nếu an toàn. │
└──────────────────────────────────────────────────────────────────┘
```

### Điểm căn cứ là gì?

Điểm căn cứ phản ánh mức độ hệ thống tìm được tài liệu phù hợp để hỗ trợ phản hồi. Điểm này được hình thành từ độ phù hợp của tài liệu, chất lượng nguồn, tính đa dạng của căn cứ và chính sách của từng bài viết.

Điểm căn cứ **không phải** lời cam kết rằng câu trả lời đúng tuyệt đối. Hệ thống đối chiếu điểm đó với ngưỡng do quản trị viên đặt. Với chủ đề nhạy cảm hoặc bài viết yêu cầu chuyên gia xác nhận, ngưỡng có thể nghiêm ngặt hơn hoặc hệ thống sẽ chuyển yêu cầu ngay cả khi đã tìm thấy tài liệu.

## Hoạt động khi có và không có Agent

| Trạng thái | Hệ thống làm gì? |
| --- | --- |
| **Agent đang hoạt động** | Khi căn cứ đủ, Agent tổng hợp phản hồi từ các nguồn hợp lệ. Có thể lưu cấu hình Gemini và Azure độc lập, nhưng chỉ một Agent được bật tại một thời điểm. Bật Agent này sẽ tắt Agent còn lại. |
| **Agent tắt, hết khả năng xử lý hoặc tạm mất kết nối** | Ứng dụng vẫn tìm kiếm trong Kho tri thức. Nếu căn cứ an toàn, người dùng nhận được các gợi ý và nguồn đã xác minh thay vì một câu trả lời được tạo mới. Hệ thống không tự suy đoán. |
| **Không có tài liệu phù hợp hoặc căn cứ quá thấp** | Hệ thống tạo Yêu cầu chuyên gia kèm lý do thật, ví dụ thiếu tài liệu hoặc thấp hơn ngưỡng cấu hình. |

Quét gộp bài viết cần Agent đang sẵn sàng. Nếu Agent không hoạt động, thao tác này được chặn an toàn và không làm thay đổi dữ liệu bài viết.

## Vòng lặp phát triển tri thức

1. Nhân viên đặt câu hỏi trong Trợ lý.
2. Hệ thống tìm nguồn và đánh giá căn cứ.
3. Nếu chưa an toàn, một Yêu cầu chuyên gia được tạo tự động.
4. Chuyên gia xác nhận câu trả lời, sau đó có thể xuất bản thành tri thức mới.
5. Lần hỏi sau, tri thức đã xác minh trở thành nguồn căn cứ để hỗ trợ phản hồi tốt hơn.

Quy trình gộp bài viết cũng giữ nguyên nguyên tắc này: Agent chỉ **đề xuất** các bài gần nhau; người có quyền luôn rà soát bản nháp trước khi phê duyệt xuất bản và lưu trữ các bài nguồn.

## Công nghệ và kiến trúc mã nguồn

- **Giao diện và máy chủ ứng dụng:** Next.js 16, React 19, TypeScript; kiến trúc Modern Bento Layout tích hợp nền Ambient Aurora Mesh Gradient tinh tế, thanh điều hướng Frosted Glass và bộ biểu tượng Bento Badge Tile phân tầng trực quan theo danh mục nghiệp vụ.
- **Cơ sở dữ liệu:** PostgreSQL tương thích, hỗ trợ triển khai với Supabase qua biến môi trường.
- **AI provider:** Google Gemini hoặc Azure OpenAI; tại một thời điểm chỉ một Agent được bật.
- **Tìm kiếm tri thức:** truy xuất theo từ khóa/hybrid, xếp hạng lại khi Agent sẵn sàng, ưu tiên tài liệu đã xác minh, còn hiệu lực và đúng chính sách.
- **Bảo mật:** phiên đăng nhập `httpOnly`, phân quyền theo vai trò ở server, mật khẩu băm, khóa provider mã hóa ở server, TOTP tùy chọn và ảnh đại diện được kiểm tra/chuẩn hóa. Login/MFA được rate limit trong PostgreSQL để chống dò mật khẩu và OTP; `TRUST_PROXY=true` chỉ dùng khi reverse proxy kiểm soát forwarding header.
- **Nhập dữ liệu:** CSV/XLSX cho nội dung văn bản, giới hạn 5 MB và 200 dòng mỗi lần, chỉ đọc worksheet đầu tiên; không lập chỉ mục tệp hình ảnh hoặc tài liệu đa phương tiện.

Các thành phần chính trong mã nguồn:

```text
app/          Đường dẫn, API và giao diện Next.js
components/   Thành phần giao diện và khung ứng dụng dùng chung
lib/          Xác thực, phân quyền, kết nối Agent, truy xuất và nghiệp vụ tri thức
db/           Lược đồ và cập nhật cơ sở dữ liệu
scripts/      Khởi tạo dữ liệu, cập nhật, đánh giá và tác vụ bảo trì
docs/         API, triển khai, bảo mật và tài liệu vận hành
```

## Bảo mật và vận hành

- Khóa API của provider được mã hóa ở máy chủ và không trả về trình duyệt.
- Login và MFA trả `429` kèm `Retry-After` khi vượt giới hạn; production vẫn cần edge/WAF rate limit bổ sung.
- Quyền giao diện chỉ hỗ trợ trải nghiệm; mọi endpoint quan trọng vẫn kiểm tra quyền ở server.
- Ảnh đại diện chỉ chủ tài khoản được đọc, được kiểm tra nội dung và chuẩn hóa thành WebP trước khi lưu.
- Tài khoản bị vô hiệu hóa có thời gian lưu giữ trước khi làm sạch; dữ liệu tri thức và yêu cầu đang mở phải được chuyển giao trước đó.
- Mọi phản hồi thiếu căn cứ đều được ưu tiên minh bạch lý do hơn là tạo nội dung không được kiểm chứng.
- **Nhật ký vận hành & Kiểm toán hệ thống:** Tự động ghi vết toàn bộ hoạt động đăng nhập, phân quyền, cấu hình AI và vòng đời bài viết tri thức (bao gồm chi tiết bài viết bị xóa vĩnh viễn, người dùng tác động). Hỗ trợ chính sách lưu trữ linh hoạt (7–3650 ngày), giao diện Bento Box chi tiết và kết xuất báo cáo Excel chuyên nghiệp (.xlsx) với định dạng bảng tính cao cấp.
- **Thành phần giao diện Bento:** Hệ thống dropdown tùy biến (`BentoSelect`) thay thế hoàn toàn native select của trình duyệt, cung cấp menu xổ xuống bo góc tròn trịa, hiệu ứng kính mờ (frosted glass), bóng đổ Bento phân lớp và dấu kiểm (checkmark) trực quan chuẩn UI/UX.
- **Tiêu chuẩn kiểm tra mật khẩu doanh nghiệp:** Tích hợp bộ quy tắc và checklist trực quan thời gian thực (tối thiểu 8 ký tự, chữ hoa, chữ thường, ký tự đặc biệt, huy hiệu độ mạnh mật khẩu và so khớp mật khẩu) đồng bộ trên cả trang Hồ sơ cá nhân lẫn hộp thoại Tạo/Chỉnh sửa tài khoản người dùng của Quản trị viên.

## Bắt đầu sử dụng

Sau khi đăng nhập, mở **Hướng dẫn sử dụng** ở sidebar (ngay dưới **Tổng quan**) để xem lộ trình phù hợp với vai trò của bạn. Trang này có các liên kết nhanh đến Trợ lý, Kho tri thức, Yêu cầu chuyên gia và Cài đặt theo đúng quyền tài khoản.

## Tài liệu liên quan

- [Hợp đồng API](docs/API.md)
- [Hướng dẫn triển khai](docs/DEPLOYMENT.md)
- [Báo cáo bảo mật mới nhất (2026-09-29)](docs/SECURITY-REPORT-2026-09-29.md)
- [Báo cáo bảo mật (2026-09-28)](docs/SECURITY-REPORT-2026-09-28.md)
