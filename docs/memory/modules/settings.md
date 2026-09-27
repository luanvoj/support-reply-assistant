# Cài đặt & AI provider

## Mục đích

Admin cấu hình provider, persona và retrieval/merge settings; secret chỉ được mã hóa/lưu ở server.

## Contract và quyết định

- Gemini và Azure OpenAI cùng được lưu nhưng chỉ một provider active dùng cho Agent tại một thời điểm.
- CTA runtime chung bật/tắt Agent đang được chọn; khi tắt, chat chỉ có thể trả gợi ý từ nguồn xác minh và các tác vụ cần Agent như quét gộp bài bị chặn an toàn.
- Azure deployment không thể suy ra chỉ từ API key; Admin nhập endpoint, key, deployment, model, API version rồi validate.
- Retrieval settings version hóa; có history/rollback. Ngưỡng tự trả lời và chủ đề nhạy cảm điều khiển quyết định Agent; không có ngưỡng “trả lời một phần”. Merge settings gồm prefilter, suggestion threshold, unique coverage và synonym.

## Việc mở/rủi ro

- Chưa có quyền/tích hợp Azure Resource Manager để liệt kê deployment tự động.
- Security report còn dependency advisory PostCSS/Next; provider endpoint và credential lifecycle phải theo deployment governance.
- `partial_answer_threshold` chỉ còn column lịch sử tương thích, không được trả qua payload UI hoặc dùng để tạo hành vi phản hồi.
