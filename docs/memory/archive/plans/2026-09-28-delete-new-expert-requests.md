# Kế hoạch: xóa vĩnh viễn yêu cầu chuyên gia mới

## Kết quả mong đợi

Chuyên gia hoặc Quản trị viên có thể xóa vĩnh viễn một yêu cầu chuyên gia tạo nhầm khi nó vẫn ở trạng thái `new`, chưa có review và chưa tạo bài tri thức. Thao tác không để lại dữ liệu câu hỏi bị lưu ngoài ý muốn.

## Phạm vi và quyết định

- Dùng quyền hiện có `ticket:write`: chỉ `technical` và `admin` có thể gọi API.
- Không thêm migration hay cấu hình: schema đã có FK `question_reviews.unanswered_question_id ... ON DELETE CASCADE`.
- API khóa ticket trong transaction, từ chối nếu ticket không phải `new` hoặc đã có review. Điều kiện được kiểm tra lại tại thời điểm xóa để tránh race với thao tác review.
- Sau khi xóa, chỉ đưa `conversations.classification` từ `escalated` về `normal` nếu hội thoại không còn ticket mở (`new`/`in_review`). Không tác động `knowledge_linked` hoặc ticket còn lại.
- Không tạo operational log cho thao tác này: log có thời hạn nhưng vẫn là dữ liệu lưu lại; mục tiêu của hard-delete là không giữ nội dung/cấu phần ticket tạo nhầm. Bài tri thức không thể tồn tại ở ticket đủ điều kiện xóa.

## Luồng/file thay đổi

1. Thêm `DELETE /api/unanswered/:id`, validate `{ confirm: true }`, RBAC, trạng thái/review và xóa transaction-safe.
2. Thêm CTA xóa chỉ trong màn chi tiết của ticket `new`, kèm xác nhận trước khi gọi API; sau thành công đóng detail và tải lại list.
3. Cập nhật API docs và INDEX để mô tả điều kiện hard-delete, quyền và tác động classification.

## Kiểm tra

- `npm run typecheck` và `npm run build`.
- Kiểm tra tĩnh endpoint: UUID/body không hợp lệ, không có quyền, không tồn tại, ticket không `new`, hoặc có review đều không xóa; ticket hợp lệ xóa và chỉ đổi classification theo điều kiện.
- Browser/RBAC thật là NOT-RUN nếu không có phiên đăng nhập phù hợp.

## Rủi ro còn lại

- Xóa là không thể hoàn tác. Native confirmation và server body confirmation chỉ giảm thao tác nhầm, không tạo cơ chế khôi phục.
- Ticket tạo lại từ cùng assistant message chỉ có thể xảy ra qua các luồng hợp lệ trong tương lai; endpoint không sửa message hay tạo lại escalation giả.
