# Xem căn cứ theo hội thoại cho nhân viên

## Mục tiêu

Cho phép nhân viên mở từng dòng “Căn cứ đã dùng” thành popup đọc căn cứ của **chính câu trả lời trong hội thoại của họ**, mà không cho phép duyệt hoặc tra cứu Kho tri thức chung.

## Quyết định đã chốt

- Không dùng endpoint bài viết chung làm nguồn cho popup.
- Nhân viên chỉ thấy căn cứ gắn với message assistant thuộc hội thoại họ có quyền đọc.
- Bài `grounded` hiển thị snapshot toàn văn tại thời điểm trả lời; bài `escalate` chỉ hiển thị excerpt và CTA báo chuyên gia.
- Dữ liệu popup là snapshot, không đổi theo bài hiện hành sau khi câu trả lời đã được tạo.

## Tác động và file/luồng dự kiến

| Khu vực | Thay đổi |
|---|---|
| RBAC | `lib/roles.ts`, guard/navigation: bỏ `knowledge:read` khỏi role nhân viên; thêm quyền đọc căn cứ hội thoại riêng nếu cần. Technical/Admin vẫn quản lý kho theo quyền hiện hành. |
| Persistence | `app/api/assistant/answer/route.ts`: ghi `articleId`, title, version, policy, excerpt và `contentSnapshot` vào `messages.retrieval_summary` JSONB. Không dùng nội dung bài hiện hành để trả lại snapshot cũ. |
| API | Tạo endpoint hội thoại-scoped, ví dụ `GET /api/conversations/:conversationId/sources/:articleId`, xác thực session + ownership/read access của conversation + article xuất hiện trong retrieval summary của assistant message. |
| UI | `components/screens/assistant-screen.tsx` và implementation citation dùng thực tế: đổi mỗi `<li>` căn cứ thành `<button>`; modal có loading/error/empty state, focus trap, Escape, nút đóng, tiêu đề bài, version/snapshot time, nội dung Markdown an toàn và CTA báo chuyên gia cho policy escalate. Rà `components/operations.tsx` để không giữ UI citation cũ nếu còn được render. |
| Audit | Ghi operational log `knowledge_evidence_opened` với actor, conversation/message/article ID, policy và thời điểm; không ghi lại toàn văn bài trong log. |
| Tài liệu/test | Cập nhật module assistant/knowledge, API contract và thêm unit/integration/E2E coverage cho policy, ownership, modal accessibility. |

## Trình tự thực hiện

1. **Chốt contract dữ liệu và quyền**
   - Phân tách rõ `knowledge:read` (duyệt kho chung) với quyền mở căn cứ hội thoại.
   - Kiểm tra tất cả route/UI CTA kho tri thức theo role sau thay đổi để không còn endpoint hay navigation mô tả sai quyền.
   - Định nghĩa payload snapshot tối thiểu và giới hạn kích thước; chỉ giữ text thuần, version, title, policy, excerpt và timestamp.

2. **Ghi snapshot khi trả lời**
   - Mở rộng `retrieval_summary` lúc tạo assistant message để lưu source snapshot riêng cho từng bài; xử lý trường hợp một bài có nhiều chunk bằng một snapshot có thứ tự rõ ràng.
   - Không làm thay đổi thuật toán retrieval, decision, citation number, fallback hay tạo yêu cầu chuyên gia hiện có.
   - Quy định hành vi với message cũ chưa có snapshot: hiển thị “Căn cứ này không còn sẵn sàng để xem chi tiết”, không fallback sang đọc trực tiếp bài hiện hành.

3. **API xem căn cứ theo hội thoại**
   - Đọc conversation/message theo quyền sở hữu hiện hữu; không nhận article ID độc lập rồi truy vấn `knowledge_articles`.
   - Chỉ trả snapshot trùng với article ID trong một assistant message thuộc conversation được phép xem.
   - Với `grounded`, trả toàn văn snapshot; với `escalate`, trả excerpt + trạng thái cần chuyên gia, không trả contentSnapshot.
   - Ghi log truy cập thành công và trả 403/404 không tiết lộ bài viết tồn tại ngoài ngữ cảnh hội thoại.

4. **CTA và modal**
   - Mỗi dòng căn cứ là button có nhãn theo title; click gọi API scoped và mở modal.
   - Render Markdown bằng renderer đã whitelist hoặc text-safe; không dùng `dangerouslySetInnerHTML`.
   - Giữ citation popover ngắn hiện có; modal là lớp xem chi tiết có trạng thái tải, lỗi và thông báo khi source đã cũ/không có snapshot.
   - CTA “Báo chuyên gia” chỉ xuất hiện trong popup `escalate` và đi vào luồng yêu cầu chuyên gia hiện có, không tạo quyền mới.

5. **Kiểm thử và nghiệm thu**
   - Unit: policy mapping grounded/escalate, parse snapshot, message cũ không snapshot.
   - API integration: nhân viên mở nguồn của hội thoại mình; bị chặn khi thử conversation khác, article ID không nằm trong message, knowledge API chung và bài archived/draft.
   - UI/E2E: mỗi dòng mở đúng title/nội dung, focus modal, Escape/close, loading/error, không hiển thị full content với escalate.
   - Regression: gửi câu hỏi, citation numbering, history 90 ngày, fallback tạo yêu cầu chuyên gia, role Technical/Admin, audit log và `npm run build`.

## Rủi ro cần kiểm soát

- Lưu full snapshot làm tăng dữ liệu trong message và đi theo retention 90 ngày; cần giới hạn kích thước và áp dụng retention/redaction hiện có.
- Nội dung tương lai có thể là nội bộ; không mở full content theo role mặc định hoặc qua article endpoint chung.
- `retrieval_summary` là JSONB không có migration bắt buộc, nhưng phải có schema runtime và migration/backfill policy cho message cũ.
- Cần xác nhận route của “Báo chuyên gia” có thể tái sử dụng với evidence popup; nếu không, giữ CTA trạng thái thông tin thay vì tạo ticket trùng.

## Thực hiện

- Đã triển khai snapshot theo message, endpoint căn cứ scoped theo ownership, nhật ký mở căn cứ, CTA từng dòng và modal an toàn.
- Không thêm CTA tạo yêu cầu chuyên gia thủ công: contract hiện tại đã tự tạo đúng một yêu cầu khi `fallback`, nên một CTA mới từ popup có thể tạo ticket trùng.
