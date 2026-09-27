# Retrieval test corpus (smoke)

| ID | Câu hỏi | Nguồn kỳ vọng | Quyết định kỳ vọng |
|---|---|---|---|
| RAG-01 | CNAME là gì? | Bài DNS CNAME | grounded hoặc partial khi chỉ có một nguồn |
| RAG-02 | Hướng dẫn SSO? | Bài SSO | grounded khi nguồn còn hiệu lực |
| RAG-03 | Chính sách hoàn tiền? | Không có bài đã xác minh | fallback/ticket |
| RAG-04 | Điều khoản SLA? | Bài SLA đã xác minh | grounded chỉ khi vượt ngưỡng nhạy cảm |
| RAG-05 | CNAME (bài cũ đã thay thế) | Bài DNS bản mới | Không chọn bản cũ |

Corpus này là smoke baseline. Bộ đánh giá production cần được mở rộng bằng dữ liệu đã được chuyên gia gán nhãn trước khi dùng để điều chỉnh ngưỡng.
