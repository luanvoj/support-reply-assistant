# Cài đặt & AI provider

## Mục đích

Admin cấu hình provider, persona và retrieval/merge settings; secret chỉ được mã hóa/lưu ở server.

## Contract và quyết định

- Gemini và Azure OpenAI cùng được lưu nhưng chỉ một provider active dùng cho Agent tại một thời điểm.
- Azure deployment không thể suy ra chỉ từ API key; Admin nhập endpoint, key, deployment, model, API version rồi validate.
- Retrieval settings version hóa; có history/rollback. Merge settings gồm prefilter, suggestion threshold, unique coverage và synonym.

## Việc mở/rủi ro

- Chưa có quyền/tích hợp Azure Resource Manager để liệt kê deployment tự động.
- Security report còn dependency advisory PostCSS/Next; provider endpoint và credential lifecycle phải theo deployment governance.
