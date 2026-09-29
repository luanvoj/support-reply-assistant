# Plan: Chuẩn hóa bố cục và tác vụ Kho kiến thức

## Kết quả mong đợi

Workspace **Kho kiến thức** có thứ bậc thao tác rõ ràng: thao tác chính của từng ngữ cảnh chỉ có một CTA nổi bật; import là tác vụ phụ mở trong modal; vùng quét gộp có lưới cân bằng; và khi mở chỉnh sửa, người dùng được đưa thẳng tới form đang mở.

Plan này dùng `my-ui` ở mode **point**: các phần tử đích đã được người dùng chỉ rõ bằng ảnh, label và route `/knowledge-base`. Không thay đổi flow nghiệp vụ import, gộp, xuất bản hay quyền hạn.

## Hiện trạng đã xác minh

- Header hiện có `Tải mẫu Excel`, `Gộp bài viết` và `+ Thêm bài viết` trong `components/operations.tsx`; liên kết tải mẫu dùng cùng class button nhưng là thẻ `<a>`, nên browser giữ kiểu gạch chân mặc định trong ảnh.
- Import CSV/XLSX đang là `import-panel` độc lập ngay dưới khu vực gộp. Preview/apply đã tồn tại trong cùng component, nên có thể di chuyển UI vào modal mà không đổi API.
- Khu vực quét dùng lưới `.merge-controls { grid-template-columns: 1fr 150px 1fr auto }`, trong khi ba control có bản chất và lượng trợ giúp khác nhau; đây là nguyên nhân bố cục không cân đối ở desktop.
- Khi `edit(id)` mở form, code chỉ đặt state `showForm`; không có ref, focus hay `scrollIntoView`, vì vậy form mở ở phía trên viewport hiện tại.
- `.ops-button.primary` hiện là màu primary chung, nhưng chưa có quy ước sử dụng theo ngữ cảnh. Ảnh cho thấy nhiều CTA đều dùng sắc nổi bật mà không có hierarchy nhất quán.

## Quyết định thiết kế đề xuất

### 1. Quy ước CTA

| Vai trò | Cách hiển thị | Ví dụ trong phạm vi này |
|---|---|---|
| Primary | Nền tím/xanh thương hiệu; tối đa một nút mỗi khu vực đang thao tác | `+ Thêm bài viết` ở header; `Bắt đầu quét` trong panel quét; `Xuất bản` trong editor; `Import dữ liệu` trong modal sau khi preview hợp lệ |
| Secondary | Viền trung tính, cùng chiều cao/chữ/căn giữa | `Gộp bài viết`, `Nhập dữ liệu`, `Lưu bản nháp`, `Đóng soạn thảo`, `Tải mẫu Excel` |
| Tertiary/link | Chữ, không tạo cạnh tranh thị giác với CTA chính | `Xem đối chiếu`, trợ giúp/tải mẫu bên trong modal nếu cần |
| Destructive | Đỏ, chỉ dùng cho thao tác phá hủy hoặc không đảo ngược | Không áp dụng cho import, quét hay xuất bản |

`Tải mẫu Excel` là một hành động phụ của import, nên đề xuất chuyển vào modal import thay vì để cùng hàng header. Điều này loại bỏ khác biệt `<a>`/`button` khỏi header và không làm người dùng phải chọn giữa ba CTA.

### 2. Bố cục quét gộp

Tách mỗi control thành một ô có label, control và trợ giúp ngay dưới; dùng grid 12 cột ở desktop: Nhóm dịch vụ 5 cột, Số bài tối đa 2 cột, Ngưỡng tương đồng 3 cột, CTA 2 cột. CTA căn đáy với control và chỉ là primary của panel này. Ở tablet/mobile chuyển lần lượt 2 cột rồi 1 cột; slider luôn chiếm toàn bộ chiều rộng ô của nó.

### 3. Import theo modal

Đặt nút secondary `Nhập dữ liệu` cạnh `Gộp bài viết` ở header. Khi mở, modal hiển thị tuần tự: chọn file → preview/validation → CTA primary `Import N bài viết`; link/nút secondary `Tải mẫu Excel` nằm gần vùng chọn file. Modal phải có đóng bằng nút, `Esc`, click backdrop (khi không đang import), focus ban đầu và giữ nguyên cảnh báo dòng lỗi hiện có.

### 4. Mở editor theo hành động chỉnh sửa

Gắn ref cho editor; sau khi tải đủ dữ liệu bài viết và render form, cuộn form vào viewport với `block: "start"`, đưa focus vào tiêu đề (hoặc heading có thể focus) mà không làm thay đổi dữ liệu. Dùng hành vi giảm chuyển động khi hệ điều hành yêu cầu. Nút `Đóng soạn thảo` tiếp tục là secondary ở cạnh phải cụm Lưu/Xuất bản.

## Các bước thực hiện

1. **Chuẩn hóa primitive CTA và header** trong `app/globals.css` và `components/operations.tsx`: bổ sung class/biến thể semantic (primary, secondary, link, danger), reset cách hiển thị của link-button/header action, xác định đúng chiều cao, padding, căn giữa và trạng thái hover/focus/disabled. Không đổi màu toàn ứng dụng ngoài các CTA thuộc Kho kiến thức.
2. **Tái cấu trúc panel Gộp bài viết** trong component và CSS theo grid đề xuất; chuyển mô tả dài thành hint dưới từng control, giữ nguyên giá trị, min/max và request scan hiện có.
3. **Đưa import vào modal**: thêm state mở/đóng riêng, di chuyển chooser, preview, validation và apply hiện có vào modal; giữ endpoint/template URL và giới hạn upload. Chỉ render panel import cũ khi modal mở, không để khoảng trống panel trên trang.
4. **Cải thiện điều hướng editor**: thêm ref và effect sau khi `edit(id)` nhận dữ liệu; scroll/focus theo accessibility, kiểm tra không gây scroll khi chỉ đóng/mở form tạo mới nếu không cần.
5. **Rà soát hiển thị bằng `my-ui` point**: desktop theo ảnh tham chiếu, tablet và mobile; kiểm tra không có CTA primary cạnh tranh trong cùng vùng, text không gạch chân/lệch baseline, modal không che thao tác thiết yếu và editor xuất hiện rõ sau click.

## File/luồng dự kiến thay đổi

- `components/operations.tsx`: header actions, state/modal import, editor ref/focus, cấu trúc controls quét.
- `app/globals.css`: token/variant CTA thuộc workspace, grid responsive, modal import và focus state.
- Có thể chỉ dùng component modal sẵn có nếu nó mở rộng được cho nội dung import; nếu không, thêm modal nội bộ trong `operations.tsx`. Không cần đổi database hay API.

## Kiểm tra nghiệm thu

1. Desktop: ba control quét thẳng hàng theo label/control/hint; `Bắt đầu quét` là CTA primary duy nhất của panel.
2. Header: chỉ `+ Thêm bài viết` primary; `Gộp bài viết` và `Nhập dữ liệu` secondary, căn giữa và cùng typography; tải mẫu nằm trong modal import.
3. Import: chọn CSV/XLSX, preview hợp lệ, preview có lỗi và import thành công vẫn hoạt động; đóng modal không làm mất dữ liệu khi chưa chủ động hủy (quy tắc này cần kiểm tra khi implement).
4. Từ danh sách bài viết đang cuộn xuống, click `Chỉnh sửa`: form hiện trong viewport và focus đúng; không phát sinh PATCH/version/audit chỉ vì mở form.
5. Responsive: 1024px, 768px và 375px không tràn ngang, CTA còn vùng bấm phù hợp, thứ tự tab/focus của modal và form hợp lý.
6. `npm run typecheck`, smoke route `/knowledge-base`, và kiểm tra thủ công UI ở viewport nêu trên.

## Rủi ro và điểm cần chốt

- Mở modal import rồi đóng: đề xuất mặc định **giữ preview/file trong phiên modal** để tránh mất công người dùng; chỉ xóa khi import thành công hoặc người dùng chọn file khác. Nếu muốn đóng là reset hoàn toàn, cần chốt trước khi implement.
- Cuộn/focus editor có thể gây khó chịu nếu user đang mở form tạo mới ở đầu trang; đề xuất chỉ auto-scroll khi gọi `Chỉnh sửa` từ danh sách, không áp dụng cho `+ Thêm bài viết`.
- Đây là thay đổi bố cục và tương tác; cần xác nhận screenshot thực tế sau triển khai, không coi typecheck là bằng chứng UI PASS.

## Trạng thái và bằng chứng

- PASS — Header dùng `Nhập dữ liệu`, `Gộp bài viết` (secondary) và `+ Thêm bài viết` (primary); không còn link Tải mẫu Excel ở header.
- PASS — Import được chuyển vào modal, giữ preview khi đóng/mở trong phiên, đóng bằng nút/Esc/backdrop khi không import; tải mẫu nằm trong modal.
- PASS — Lưới quét được cân theo 5/2/3/2 ở desktop và breakpoint tablet/mobile.
- PASS — Click Chỉnh sửa dùng ref để scroll/focus đến editor; tạo mới không kích hoạt auto-scroll.
- PASS — `npm run typecheck`, `npm run build`, restart local và HTTP 200 tại `/knowledge-base`.
- NOT-RUN — Chưa có bằng chứng screenshot/DOM ở 1024px, 768px, 375px và chưa thao tác upload thật trong modal ở phiên này; cần người dùng nghiệm thu trực quan.
