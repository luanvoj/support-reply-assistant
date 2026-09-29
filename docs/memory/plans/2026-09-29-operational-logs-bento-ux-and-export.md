# Kế hoạch điều chỉnh UI Nhật ký vận hành & Nâng cấp báo cáo xuất Excel

- **Ngày lập**: 2026-09-29
- **Trạng thái**: Đã hoàn thành (Completed)
- **Căn cứ yêu cầu**: Đánh giá thực tế từ người dùng và bằng chứng ảnh màn hình tab Nhật ký vận hành & bảng tính Excel xuất ra.

---

## 1. Bối cảnh & Vấn đề đã xác minh

Dựa trên hình ảnh thực tế và phản hồi từ người dùng:

1. **Toolbar bộ lọc chưa chuẩn Bento System Design**:
   - Hàng loạt 7 control (Loại hoạt động, Từ ngày, Đến ngày, Thời gian, Lưu nhật ký, Lưu hạn, Xuất Excel, Xuất CSV) bị nhồi nhét trên một hàng ngang không cân xứng, dễ tràn vỡ layout ở màn hình vừa và nhỏ.
   - **Xung đột ngữ cảnh**: Ô nhập cấu hình *"Lưu nhật ký (ngày)"* và nút *"Lưu hạn"* (vốn là cài đặt chính sách hệ thống - Retention Policy) lại bị đặt chung với các bộ lọc tìm kiếm nhật ký hàng ngày.
2. **Nút xuất dữ liệu bị thừa thãi**:
   - Hai nút tách biệt `[Xuất Excel]` và `[Xuất CSV]` đặt cạnh nhau là không cần thiết. Người dùng doanh nghiệp chỉ cần một nút xuất chuẩn **Excel (.xlsx)** chuyên nghiệp, hỗ trợ định dạng cột, tiêu đề in đậm, tiếng Việt UTF-8 và tự động căn độ rộng.
3. **Chi tiết hành động in khối JSON thô kệch (`<pre>{JSON.stringify(...)}</pre>`)**:
   - Khi người dùng bấm xem chi tiết sự kiện (ví dụ: `admin đã xóa vĩnh viễn bài viết`), giao diện hiển thị nguyên khối JSON thô:
     ```json
     {
       "title": "Tổng quan bản ghi DNS cho email: MX, SPF và DKIM (bản gộp)",
       "articleId": "f47ae68c-b8b5-40ef-a57d-14b7e468b1ff"
     }
     ```
     Điều này không thân thiện với người dùng nghiệp vụ và không đồng nhất với phong cách thiết kế Bento sang trọng của ứng dụng.
4. **Nội dung file Excel xuất ra thiếu thông tin chi tiết**:
   - Trong file Excel (hình 2), cột `Hành động` chỉ ghi vỏn vẹn: `admin đã xóa vĩnh viễn bài viết` mà không hề ghi rõ tên bài viết nào bị xóa.
   - Nguyên nhân: `app/api/operational-logs/export/route.ts` chỉ `SELECT ol.summary` mà không truy vấn trường `ol.details`, đồng thời `lib/operational-log-export.ts` chỉ in lại nguyên văn `summary` mà không bổ sung thông tin đối tượng bị tác động.

---

## 2. Mục tiêu & Kết quả mong đợi

1. **Giao diện Nhật ký vận hành chuẩn Modern Bento**:
   - **Bento Retention Panel**: Tách cấu hình thời hạn lưu nhật ký thành một khối Bento nhỏ độc lập, tinh tế ở góc phải hoặc phía trên danh sách.
   - **Bento Log Filter Toolbar**: Nhóm bộ lọc tìm kiếm thông minh:
     + Phân loại sự kiện (Badge pills / Select).
     + Preset thời gian nhanh (Hôm nay, 7 ngày qua, 30 ngày qua, Toàn bộ thời gian, Tùy chọn ngày).
     + Badge đếm tổng số bản ghi (KPI Count: ví dụ `128 sự kiện`).
     + Nút xuất duy nhất: `[Xuất báo cáo Excel]` có icon spreadsheet chuyên nghiệp, hiển thị trạng thái loading rõ ràng.
   - **Human-readable Detail Card**: Thay thế khối JSON thô bằng Bento Metadata Cards / Chips trực quan:
     + Tên bài viết / Tài liệu: hiển thị nổi bật với icon bài viết.
     + Mã định danh (ID): chip nhỏ gọn dễ sao chép.
     + Các tham số cấu hình: hiển thị dạng bảng cặp nhãn - giá trị (Key - Value) rõ ràng.
2. **Báo cáo Excel chi tiết & chuyên nghiệp**:
   - Cột `Hành động` hoặc bổ sung cột `Chi tiết đối tượng tác động` trong Excel để nêu rõ bài viết nào bị xóa/thay đổi:
     - Ví dụ: `admin đã xóa vĩnh viễn bài viết: "Tổng quan bản ghi DNS cho email: MX, SPF và DKIM (bản gộp)" [Mã: f47ae68c...]`.
   - Bổ sung cột `Phân loại` (`Đăng nhập`, `Tài khoản`, `Tri thức`, `Cấu hình`).
   - Định dạng bảng tính: Tiêu đề in đậm, nền xanh pastel thương hiệu nhẹ, độ rộng cột tự động điều chỉnh, đóng băng dòng đầu tiên.

---

## 3. Các tệp và luồng sẽ thay đổi

| STT | Tệp tin | Trách nhiệm thay đổi |
|:---:|---|---|
| 1 | `lib/operational-log-export.ts` | Cập nhật hàm xuất Excel: diễn giải chi tiết hành động dựa trên `details`, bổ sung cột `Phân loại` và `Đối tượng tác động`, định dạng bảng tính chuyên nghiệp. |
| 2 | `app/api/operational-logs/export/route.ts` | Truy vấn thêm `ol.details`, `ol.category`, `ol.target_snapshot` từ cơ sở dữ liệu để cung cấp dữ liệu cho file Excel. |
| 3 | `components/screens/settings-screen.tsx` | Tái cấu trúc component `LogsTab`: tách Bento Retention Panel, tinh gọn toolbar bộ lọc, gộp nút xuất thành 1 nút Excel, xây dựng UI hiển thị chi tiết hành động thân thiện (không còn `<pre>JSON</pre>`). |
| 4 | `app/bento-layout.css` | Bổ sung các rule CSS cho Bento Log Toolbar, Bento Detail Cards, chips hiển thị metadata sự kiện. |
| 5 | `docs/QC-REPORT-2026-09-29.md` | Bổ sung kết quả kiểm định sau khi hoàn thành. |

---

## 4. Các bước triển khai tuần tự

### Bước 1: Nâng cấp Backend & Hàm Xuất Báo cáo Excel
- Sửa `app/api/operational-logs/export/route.ts` để SELECT đầy đủ: `ol.summary, ol.created_at, ol.category, ol.action, ol.details, ol.target_snapshot, actor_email`.
- Sửa `lib/operational-log-export.ts`:
  - Viết hàm định dạng chi tiết hành động `formatActionDetail(summary, details, category, action)`.
  - Nếu là xóa bài viết (`knowledge_article_hard_deleted`): Bổ sung rõ tên bài viết: `${summary}: "${details.title}" (Mã: ${details.articleId})`.
  - Nếu là đổi cấu hình: Bổ sung các tham số thay đổi (ví dụ: `Thời hạn lưu: ${details.retentionDays} ngày`).
  - Chuẩn hóa các cột trong Excel: `Thời điểm`, `Thời gian`, `Người thực hiện`, `Phân loại`, `Hành động & Chi tiết đối tượng`.

### Bước 2: Tái Cấu Trúc UI Tab Nhật Ký Theo Bento System Design
- Tại `components/screens/settings-screen.tsx` (component `LogsTab`):
  - **Khối 1: Header & Chính sách lưu trữ (Bento Policy Sub-panel)**: Tách riêng phần "Chính sách lưu nhật ký (ngày)" với ô nhập và nút "Lưu chính sách" gọn gàng, có nhãn rõ ràng.
  - **Khối 2: Bento Log Toolbar**:
    + Bên trái: Bộ chọn loại hoạt động + Bộ chọn khoảng thời gian (Hôm nay / 7 ngày / 30 ngày / Tùy chọn).
    + Bên phải: Huy hiệu đếm số bản ghi + Duy nhất 1 nút `[Xuất báo cáo Excel]` có icon và spinner loading.
  - **Khối 3: Bento Event Timeline & Card Item**:
    + Mỗi dòng sự kiện có badge màu tương ứng từng category (`Đăng nhập` - Xanh dương, `Tài khoản` - Tím, `Tri thức` - Xanh ngọc, `Cấu hình` - Cam).
    + Khi click xem chi tiết: Thay thế thẻ `<pre>` bằng component hiển thị thẻ chi tiết Bento (tên bài viết dạng link/chip, mã định danh, chi tiết tham số có icon).

### Bước 3: Thêm Styles CSS vào `app/bento-layout.css`
- Định nghĩa các lớp CSS:
  - `.bento-log-policy-bar`: thanh cấu hình chính sách lưu trữ tinh tế.
  - `.bento-log-toolbar`: lưới bộ lọc linh hoạt, tự co giãn theo breakpoint.
  - `.bento-log-detail-box`: hộp chi tiết sự kiện với nền pastel mờ, viền bo tròn 8px, typography rõ ràng.
  - `.bento-log-meta-tag`: chip hiển thị nhãn và giá trị của từng thuộc tính.

### Bước 4: Kiểm Thử Nghiệm Thu & Đảm Bảo Không Suy Thoái
- Chạy `npm run typecheck` và `npm run build` để kiểm tra toàn bộ mã nguồn.
- Tải file Excel thực tế qua endpoint `GET /api/operational-logs/export?format=xlsx` và kiểm tra nội dung hiển thị tên bài viết đã xóa.
- Kiểm tra thao tác lọc theo ngày, danh mục và lưu hạn lưu trữ.

---

## 5. Kịch bản kiểm thử (Verification & Acceptance Criteria)

1. **Giao diện UI**:
   - Toolbar hiển thị gọn gàng, không bị tràn ngang ở các kích thước màn hình 1280px, 1024px, 768px.
   - Chỉ có duy nhất 1 nút `[Xuất báo cáo Excel]` (không còn nút CSV cạnh tranh).
   - Khi bấm xem chi tiết sự kiện xóa bài viết: hiển thị tên bài viết rõ ràng, không còn hiển thị raw JSON `{ "title": ... }`.
2. **File Excel xuất ra**:
   - Mở file `.xlsx` bằng Excel/Google Sheets:
     - Dòng tiêu đề in đậm, cố định khi cuộn.
     - Cột hành động ghi rõ ràng tên bài viết bị xóa (ví dụ: `admin đã xóa vĩnh viễn bài viết: "Tổng quan bản ghi DNS cho email: MX, SPF và DKIM (bản gộp)"`).
3. **Phân quyền & Hiệu năng**:
   - Chỉ tài khoản `admin` mới thấy tab và có quyền xuất Excel.
   - Thao tác xuất 100+ bản ghi diễn ra nhanh chóng dưới 1.5 giây.
