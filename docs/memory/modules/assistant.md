# Trợ lý & RAG

## Mục đích

Trả lời theo tri thức xuất bản có căn cứ; thiếu căn cứ hoặc policy yêu cầu escalation sẽ tạo luồng chuyên gia thay vì bịa câu trả lời.

## Contract và quyết định

- `POST /api/assistant/answer` lưu lượt chat, retrieval log và quyết định `answered`/`fallback`; phản hồi trả thêm tên Agent đang hoạt động và trạng thái escalation.
- Retrieval dùng lexical/hybrid ranking, ưu tiên bài verified, còn hiệu lực và không bị thay thế.
- Citation UI hiển thị badge nguồn thay vì marker thô; lịch sử hội thoại retention mặc định 90 ngày.
- Persona được Admin cấu hình nhưng không được thay thế nguyên tắc grounded/safety.
- `fallback` tự tạo một yêu cầu chuyên gia; không còn CTA chuyển chuyên gia thủ công hay nhánh trả lời một phần. Yêu cầu liên kết duy nhất với assistant message để không tạo trùng.
- Khi căn cứ đủ nhưng Agent tắt, trong cooldown hoặc tạm không sẵn sàng, `knowledge_suggestions` trả nguồn đã xác minh để tham khảo; outage provider không tự tạo yêu cầu chuyên gia.
- Mỗi message có `sequence_no` theo hội thoại. API chi tiết hội thoại đọc theo thứ tự này; migration đã gán thứ tự cho dữ liệu cũ.

## Việc mở/rủi ro

- Chưa chốt embedding provider/model và chưa có semantic vector evaluation thật.
- Test corpus là smoke baseline; cần tập dữ liệu chuyên gia gán nhãn nếu điều chỉnh ngưỡng production.
