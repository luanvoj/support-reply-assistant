# Plan: làm rõ flow gộp và nhớ quyết định theo cặp bài

## Kết quả mong đợi

Người dùng hiểu rõ hai bước của chức năng Gộp bài viết. Hệ thống không gọi Agent lặp lại cho cùng một cặp bài đã có kết luận **Không nên gộp** khi nội dung hai bài không đổi, nhưng vẫn phát hiện bình thường các cặp mới có A–C, A–D hoặc B–C. Khi mở chỉnh sửa bài viết nhưng không thay đổi dữ liệu, không thể tạo một lần cập nhật/version/audit giả.

## Hiện trạng đã xác minh

- Bước quét dùng lexical prefilter rồi Agent rerank để đề xuất; bước tạo nháp mới yêu cầu Agent phân tích sâu và quyết định `keep_separate` hoặc tạo nháp.
- `KEEP_SEPARATE` hiện được lưu trên `knowledge_merge_batch_items` của một batch, nhưng lượt quét mới không đọc kết quả cũ nên có thể đề xuất lại cùng cặp.
- Bản nháp thực tế chỉ được tạo từ hai bài (`suggest` lấy một bài nguồn và một bài khớp). Tuy nhiên worker quét hiện có thể lưu một batch item gồm bài nguồn cộng tối đa hai candidate. Đây là mơ hồ và không phù hợp để ghi nhớ quyết định theo cặp.
- `knowledge_articles.version` tăng khi nội dung bài được cập nhật, nên có thể dùng làm điều kiện làm mới kết luận cũ thay vì bỏ qua vĩnh viễn.
- Hiện tại `PATCH /api/knowledge/articles/[id]` luôn tăng `version`, thay chunks và ghi audit mỗi lần được gọi, kể cả khi payload giống dữ liệu đang lưu. Frontend cũng không lưu snapshot ban đầu để khóa nút Lưu/Xuất bản khi không có thay đổi.

## Phương án được đề xuất

Dùng **sổ quyết định theo cặp, có hiệu lực theo phiên bản bài viết**.

Mỗi khi Agent kết luận “Không nên gộp” cho A và B, lưu một bản ghi chuẩn hóa theo cặp không thứ tự (`article_low_id`, `article_high_id`) cùng **snapshot version của cả hai bài tại thời điểm Agent ra quyết định** (`low_version`, `high_version`), lý do an toàn và thời điểm quyết định. Đây là cơ sở bắt buộc để so sánh ở lượt scan sau.

Ở lượt quét sau, chỉ bỏ qua A–B khi cả hai phiên bản vẫn khớp bản ghi. Nếu A hoặc B được sửa, kết luận hết hiệu lực và cặp được phép quét/phân tích lại. Các cặp A–C, A–D, B–C và B–D không có bản ghi tương ứng nên vẫn được quét bình thường.

Ví dụ:

| Lượt | Cặp | Kết quả |
|---|---|---|
| 1 | A–B | Agent: Không nên gộp → lưu quyết định A–B tại phiên bản hiện tại |
| 2 | A–B | Bỏ qua trước Agent; hiển thị số cặp đã bỏ qua nếu cần |
| 3 | A–C, B–C | Vẫn quét và có thể đề xuất từng cặp; A–B không tự động bị đưa vào nhóm ba bài |
| 4 | A được cập nhật | Quyết định A–B cũ hết hiệu lực; A–B được quét lại |

## Các bước triển khai

1. Cập nhật phần mô tả trong workspace Gộp bài thành hai bước rõ ràng: quét/xếp hạng đề xuất và phân tích sâu khi tạo nháp. Đổi nhãn `Giữ riêng` thành **Không nên gộp**; giữ lý do ngay bên cạnh.
2. Thêm bảng quyết định cặp bài bằng migration idempotent: hai article ID chuẩn hóa, snapshot version, quyết định, lý do hiển thị an toàn, nguồn quyết định, thời gian và index/unique key cho cặp + phiên bản. Không lưu prompt, secret hoặc phản hồi thô của provider.
3. Chuẩn hóa worker quét để mỗi batch item là đúng một cặp bài. Trước Agent rerank, loại các cặp có kết luận `not_merge` còn hiệu lực; trả số cặp bị bỏ qua vào kết quả/quy trình batch để quan sát được hiệu quả.
4. Khi Agent trả `keep_separate`, ghi/upsert quyết định cho đúng cặp mà lần tạo nháp đã phân tích. Khi tạo nháp thành công hoặc một bài đổi version, không dùng kết luận cũ để chặn cặp khác.
5. UI: hiển thị mô tả hai bước, “Không nên gộp”, lý do, và tùy chọn thông tin “đã bỏ qua X cặp đã đánh giá” mà không làm người dùng hiểu nhầm là các bài bị ẩn vĩnh viễn.
6. Chỉnh sửa bài viết: lưu snapshot chuẩn hóa của các trường có thể sửa khi mở editor; chỉ bật **Lưu bản nháp** và **Xuất bản** khi có thay đổi có ý nghĩa. Chuyển nút **Đóng soạn thảo** từ header xuống cạnh nút Xuất bản để đóng form mà không ghi dữ liệu.
7. Backend chống no-op: trong transaction, so sánh dữ liệu chuẩn hóa hiện tại với payload trước khi tăng `version`, thay chunks hoặc ghi audit. Nếu không có thay đổi có ý nghĩa, trả kết quả `no_change` thay vì coi là cập nhật.
8. Kiểm tra: mở/sau đó đóng editor không tạo request; mở editor rồi bấm Lưu/Xuất bản khi không thay đổi bị khóa; thay đổi một trường thì lưu thành công và version tăng đúng một lần; A–B bị từ chối rồi scan lại; A–C/B–C vẫn xuất hiện; sửa A rồi A–B xuất hiện lại; tạo nháp đúng hai bài; kiểm tra quyền, idempotency và không có dữ liệu nhạy cảm trong API/UI.

## File/luồng dự kiến thay đổi

- `scripts/migrate.ts` và migration schema cho sổ quyết định cặp.
- `lib/knowledge/merge-batch.ts`, `app/api/knowledge/merge/suggest/route.ts`, route ghi outcome và route batch detail.
- `components/operations.tsx`, `app/globals.css`, `app/api/knowledge/articles/[id]/route.ts`.
- Smoke/integration test cho lọc cặp theo version và tạo nháp đúng hai bài.

## Thực hiện và bằng chứng

- PASS — Đã thêm bảng `knowledge_merge_pair_decisions` với cặp UUID chuẩn hóa, snapshot version, unique key và index lookup; `npm run db:migrate` xác nhận schema có 27 public tables.
- PASS — Worker quét tạo batch item theo từng cặp hai bài và bỏ qua cặp có quyết định `not_merge` còn đúng version; cặp mới với bài C/D không dùng lại quyết định A–B.
- PASS — Khi outcome `KEEP_SEPARATE` được ghi cho batch item hai bài, backend lưu/upsert quyết định pair cùng version hiện tại.
- PASS — Editor lưu snapshot ban đầu, khóa Lưu/Xuất bản khi mở một bài có sẵn mà chưa đổi trường nào; nút Đóng soạn thảo nằm cạnh các nút thao tác.
- PASS — `npm run typecheck`.
- NOT-RUN — Chưa hoàn tất kiểm tra thủ công UI mô tả hai bước/nhãn trạng thái và backend no-op response; tiếp tục ở lượt triển khai kế tiếp trước khi đóng plan.

## Rủi ro và quyết định còn mở

- Không được bỏ qua vĩnh viễn chỉ theo article ID: một lần sửa nội dung phải cho phép đánh giá lại. Phương án đề xuất dùng `version` để giải quyết.
- Không được suy diễn “A không gộp B” thành “A không gộp C” hoặc “A/B/C không thể gộp”. Các quyết định chỉ áp dụng cho đúng cặp.
- Cần chốt quy tắc trạng thái: khuyến nghị coi chuyển bản nháp sang xuất bản là thay đổi có ý nghĩa dù nội dung không đổi; còn bài đã xuất bản mở ra rồi bấm Xuất bản không chỉnh sửa phải bị khóa. Nếu yêu cầu “phải nhập dữ liệu” áp dụng cả cho draft → publish, cần xác nhận vì điều đó sẽ chặn thao tác xuất bản một bản nháp đã hoàn chỉnh.
- Cần quyết định sau triển khai: có cho Admin nút “đánh giá lại ngay” để bỏ qua kết luận còn hiệu lực hay không. Khuyến nghị ban đầu: có nút này, nhưng yêu cầu xác nhận để tránh tốn chi phí Agent ngoài ý muốn.
