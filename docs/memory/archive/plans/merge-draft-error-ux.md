# Plan: làm rõ lỗi tạo bản nháp gộp

## Mục tiêu

Khi một nhóm gộp không tạo được bản nháp, người dùng biết nguyên nhân theo ngôn ngữ nghiệp vụ, biết nơi cần kiểm tra và có hành động tiếp theo ngay tại nhóm đó.

## Hiện trạng đã xác minh

- UI gom mọi kết quả thất bại thành `MERGE_DRAFT_FAILED`, kể cả khi Agent trả kết luận hợp lệ là nên giữ hai bài riêng.
- Batch trong ảnh đã đi qua bước quét/rerank để tạo các nhóm đề xuất; đây là bằng chứng mạnh rằng Agent đã hoạt động ở bước đó. Câu “kiểm tra Agent” hiện tại chỉ là fallback chung, không phải kết luận rằng Agent chưa được bật.
- `knowledge_merge_errors` đã lưu lỗi, nhưng API batch detail và UI chưa trả/hiển thị lịch sử lỗi.
- `components/operations.tsx` chỉ nối mã lỗi vào `reason`; không có badge trạng thái, chi tiết lỗi, retry theo nhóm hay hướng dẫn dựa trên nguyên nhân thực tế.
- Luồng client tự gọi `/api/knowledge/merge/suggest`, sau đó gọi `attach` hoặc `fail`, làm mất nguyên nhân gốc nếu request tạo nháp thất bại.

## Phạm vi dự kiến

1. Chuẩn hóa mã kết quả tạo nháp: `agent_not_configured` (chỉ khi truy vấn thật sự không có provider bật), `agent_request_failed`, `agent_invalid_response`, `keep_separate`, `no_suitable_match`, `attach_failed`.
2. Trả về và lưu thông điệp người dùng, bước lỗi, thời điểm và mã tham chiếu an toàn cho từng batch item; không trả secret, prompt hoặc lỗi thô của provider.
3. Đổi UI dòng nhóm thành các trạng thái rõ: tạo được, giữ riêng, cần xử lý; thêm CTA phù hợp như thử lại nhóm và xem chi tiết. Chỉ hiển thị “Agent chưa được cấu hình” hoặc CTA mở cấu hình khi mã chẩn đoán xác nhận đúng điều đó.
4. Kiểm tra end-to-end các case Agent tắt, Agent trả `keep_separate`, lỗi provider và tạo nháp thành công; xác nhận retry không tạo bản nháp trùng.

## File/luồng dự kiến thay đổi

- `app/api/knowledge/merge/suggest/route.ts` hoặc một orchestration route server-side mới cho batch item.
- `app/api/knowledge/merge/batches/[id]/route.ts` và route đánh dấu thất bại.
- `components/operations.tsx` và `app/globals.css`.
- Test/smoke cho merge batch và trạng thái lỗi.

## Thực hiện và bằng chứng

- PASS — API tạo nháp trả mã kết quả phân biệt: Agent chưa cấu hình, Agent gọi thất bại, phản hồi Agent không hợp lệ, giữ riêng, không có bài phù hợp và lỗi gắn bản nháp.
- PASS — Route lưu kết quả chỉ nhận mã đã whitelist; thông điệp người dùng và bước chẩn đoán được xác định ở server, không nhận lỗi thô hay secret từ client.
- PASS — Batch detail trả lịch sử lỗi an toàn theo từng nhóm; UI hiển thị mã, chi tiết, trạng thái giữ riêng và nút thử lại theo nhóm.
- PASS — `npm run typecheck`, `npm run db:migrate`, `npm run build`, `GET /api/health` (200, database ok), `GET /knowledge-base` (200) sau khi khởi động lại dev server.
- NOT-RUN — Chưa có harness/mocking provider để kích hoạt tự động từng nhánh Agent trong giao diện. Cần nghiệm thu thủ công bằng một batch thực tế nếu muốn xác nhận từng mã runtime.

## Rủi ro và quyết định cần giữ

- Không coi `keep_separate` là lỗi kỹ thuật hoặc cho phép retry vô hạn.
- Agent đã được cấu hình vẫn có thể lỗi ở lời gọi tạo nháp, dữ liệu phản hồi, hoặc bước lưu/đính kèm. UI phải nêu đúng bước thất bại thay vì hướng người dùng “kiểm tra Agent” một cách mơ hồ.
- Nếu đưa thao tác tạo nháp về một API server-side duy nhất, cần giữ kiểm tra quyền `knowledge:write` và idempotency theo batch item.
- Lỗi hiển thị cho người dùng phải có thể hành động được; diagnostic provider chỉ dành cho quản trị viên và phải được lọc secret.
