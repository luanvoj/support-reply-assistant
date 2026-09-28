# Kho tri thức & gộp bài

## Mục đích

Quản lý bài text-only để Agent truy hồi; hỗ trợ import, version/chunk, archive/restore và gộp bài có kiểm duyệt.

## Contract và quyết định

- Import CSV/XLSX preview trước apply; tiêu đề trùng được đánh số; import giữ audit/rollback khi an toàn.
- Bài archive không dùng cho câu trả lời mới; restore đưa về draft. Sau xác nhận, xóa vĩnh viễn bài archive kể cả khi có citation hoặc liên kết review/import/merge; nhật ký vận hành chỉ giữ metadata thao tác.
- Merge batch giới hạn phạm vi theo service group/policy, lexical prefilter rồi Agent rerank; chỉ xuất bản/lưu trữ nguồn sau Admin duyệt draft.
- Điểm rerank bị giới hạn 0–1. Synonym/ngưỡng merge lưu trong retrieval settings và được snapshot vào batch.

## Việc mở/rủi ro

- Workspace hiện chưa cho bật/tắt `verified-only` hoặc đặt kích thước nhóm gộp; worker đang giới hạn tối đa hai candidate cho nguồn.
- Retry batch có API; cần cân nhắc CTA retry rõ ràng ở UI nếu vận hành thường xuyên.
