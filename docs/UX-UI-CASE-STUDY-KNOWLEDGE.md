# Case study: Chuẩn hóa UX/UI cho Kho kiến thức

## Bối cảnh

Kho kiến thức là nơi người vận hành nhập, chỉnh sửa, xuất bản, import và gộp nguồn dùng để trả lời khách hàng. Các chức năng đã hoạt động nhưng những thao tác liên quan bị phân tán, CTA cạnh tranh nhau và giao diện không phản ánh rõ trạng thái vận hành.

## Vấn đề đã xác minh

| Vấn đề | Ảnh hưởng |
|---|---|
| Quét gộp có control/hint/CTA không cùng nhịp lưới | Người dùng khó quét mắt và khó hiểu đâu là thao tác chính. |
| Import chiếm panel riêng | Làm đứt mạch từ quản lý bài viết sang danh sách. |
| Mở chỉnh sửa ở vị trí ngoài viewport | Người dùng tưởng thao tác không có hiệu lực. |
| CTA/link/pill có style và kích thước không nhất quán | Giảm niềm tin vào hierarchy của ứng dụng. |
| Hàng bài viết không có chiến lược responsive theo độ ưu tiên | Zoom làm pill và hành động chồng lên nhau. |
| Đề xuất gộp có trạng thái kỹ thuật hoặc trạng thái đã hoàn tất vẫn có thể thao tác | Tăng chi phí Agent và gây lỗi khó hiểu. |

## Nguyên tắc đã áp dụng

1. **Một hành động chính cho một ngữ cảnh.** Header ưu tiên thêm bài viết; panel quét ưu tiên bắt đầu quét; editor ưu tiên xuất bản; modal import ưu tiên import sau preview.
2. **Tác vụ phụ chỉ xuất hiện khi cần.** Import mở trong modal; tải mẫu là trợ giúp đặt cạnh đúng bước chọn tệp.
3. **Trạng thái nói bằng ngôn ngữ vận hành.** Ẩn điểm/công thức Agent khỏi người dùng cuối; thể hiện ngắn gọn như đã tạo nháp, giữ nguyên hoặc cần xử lý.
4. **Responsive theo thứ tự thông tin.** Trong hàng bài viết: giữ tiêu đề và hành động, ẩn pill/trường phụ trước; không để các phần tử cạnh tranh không gian.
5. **Không thay đổi dữ liệu khi không có ý định.** Form mở để xem không được tạo version/audit; editor đưa người dùng đến đúng vị trí khi có ý định chỉnh sửa.
6. **Trạng thái hoàn tất không được tái hành động.** Cặp nguồn đã có bản gộp được duyệt bị khóa trong batch cũ và không gọi Agent lại.

## Điều chỉnh đã triển khai

- **Smart Merge Workspace (Modern Bento Layout)**: Khu vực quét và đối chiếu gộp bài viết được tái cấu trúc thành không gian Bento hiện đại:
  - Header chuyên biệt với eyebrow định danh nghiệp vụ: `KHÔNG GIAN LÀM VIỆC TRI THỨC / QUÉT & ĐỐI CHIẾU THÔNG MINH`.
  - Grid 4 thẻ KPI chỉ số trực quan (Tổng ứng viên, Đã phân tích, Đã tạo nháp, Đã hợp nhất an toàn).
  - Bộ nút chọn nhanh ngưỡng tương đồng preset (65% Khám phá rộng, 75% Tiêu chuẩn, 85% Nghiêm ngặt).
  - Trạng thái trống (Empty state) chuẩn Bento có icon vector, chỉ báo trạng thái và CTA hướng dẫn người dùng bắt đầu lượt quét.
  - Modal đối chiếu 2 cột (Diff Modal) chi tiết giữa tài liệu nguồn và bản nháp đề xuất trước khi người vận hành phê duyệt.
- **Chuẩn hóa nhãn Eyebrow & Desc trên 9 màn hình**: Loại bỏ hoàn toàn sự trùng lặp breadcrumb (`KHÔNG GIAN LÀM VIỆC / ...`), áp dụng hệ thống phân tầng nghiệp vụ chuyên nghiệp (VD: Trợ lý -> `HỎI ĐÁP & HỖ TRỢ / TRỢ LÝ TRUY XUẤT CĂN CỨ`, Hàng đợi -> `HÀNG ĐỢI NGHIỆP VỤ / YÊU CẦU CẦN CHUYÊN GIA XÁC NHẬN`).
- **Bento Navigation & Ambient Aurora**:
  - Bộ biểu tượng vector sắc nét (độ dày 1.8 stroke, hình khối nhận diện duotone).
  - Hộp Bento Icon Badge Tile (`.bento-nav-icon-badge`) cho từng mục điều hướng với màu sắc phân tầng theo danh mục chức năng.
  - Màu nền Ambient Aurora Mesh Gradient đa tầng tạo chiều sâu không gian, kết hợp khung điều hướng Frosted Glass (Sidebar & Topbar).
- Import CSV/XLSX chuyển sang modal có preview, validation, tải file mẫu, Esc/backdrop và không mất preview trước khi import.
- Editor có scroll/focus khi mở từ `Chỉnh sửa`; có nút đóng cạnh Lưu/Xuất bản.
- CTA primary dùng nền đặc, border/shadow/focus thống nhất; CTA secondary và link có vai trò riêng.
- Pagination có vùng tách khỏi item cuối.
- Pill trong hàng bài viết tự co theo text, không theo chiều rộng grid; metadata phụ bị ẩn dần ở viewport hẹp.
- Merge pair đã duyệt được đánh dấu không thể tạo nháp lại.

## Tiêu chuẩn tái sử dụng

- CTA: primary / secondary / link / destructive có semantic rõ; không dùng màu nổi chỉ vì muốn thu hút.
- Surface: panel, card, list row, bento tile và modal dùng cùng border, radius, shadow và spacing token.
- Navigation: icon nằm trong hộp badge tile 32x32px với màu nhận diện danh mục, hiệu ứng hover/active đồng bộ với dải chỉ thị viên ngọc.
- Form: label → control → hint/error theo cùng khoảng cách; focus state thống nhất.
- List: title là thông tin không được hy sinh; state và metadata là thông tin có thể giảm dần ở viewport hẹp.
- Modal: tiêu đề, mô tả, thao tác chính, đóng an toàn, keyboard/focus rõ ràng.

## Bằng chứng và giới hạn

Các thay đổi trên đã được kiểm tra bằng source, `npm run typecheck`, lệnh `npm run build` trên Next.js 16 thành công hoàn toàn (0 lỗi biên dịch, exit code 0). Nghiệm thu ảnh ở tất cả browser/viewport chưa hoàn tất trong phiên này; không coi đây là bằng chứng visual PASS toàn ứng dụng.
