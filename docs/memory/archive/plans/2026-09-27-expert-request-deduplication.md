# Kế hoạch: gộp yêu cầu chuyên gia trùng lặp

## Mục tiêu

Khi nhiều nhân sự gặp **cùng một vấn đề**, hệ thống vận hành một yêu cầu chuyên gia chung thay vì tạo nhiều dòng trùng trong danh sách. Mỗi lần hỏi vẫn phải được lưu và người gửi vẫn theo dõi được yêu cầu của mình trong hội thoại; không được xóa hoặc làm mất lịch sử nguồn.

## Hiện trạng đã xác minh

- `unanswered_questions` hiện là cả **phiếu vận hành** lẫn **lần nhân sự báo vấn đề**.
- Chỉ có cơ chế unique theo `source_message_id`: một tin nhắn không tạo hai phiếu, nhưng hai người khác nhau hỏi cùng câu vẫn tạo hai phiếu.
- API danh sách, dashboard, review và deep link đều đang đọc trực tiếp từng `unanswered_questions`, nên số lượng mở và bảng hiển thị bị nhân đôi.
- Luồng Agent hai nhánh đã tự tạo yêu cầu chuyên gia khi thiếu căn cứ/độ tin cậy thấp/chính sách buộc chuyên gia; đây là điểm chèn cơ chế gộp an toàn.

## Quyết định thiết kế

Tách hai khái niệm:

```text
Vấn đề chuyên gia (một công việc chung) ──< Lần báo vấn đề (một người hỏi/một hội thoại)
```

- Tạo bảng `expert_request_groups` làm phiếu công việc chung: câu hỏi đại diện, khóa trùng, trạng thái, người phụ trách, số lần báo, lần phát sinh gần nhất và mốc audit.
- Giữ `unanswered_questions` là từng lần báo, bổ sung `group_id`. Mọi `conversation_id`, `source_message_id`, `created_by`, lý do và điểm retrieval hiện có được giữ nguyên.
- Danh sách chuyên gia hiển thị **một group một dòng**: câu hỏi đại diện, lý do, `N người đã gặp`, trạng thái, người phụ trách và thời điểm mới nhất. Mở chi tiết mới thấy các lần báo liên quan.
- Thay đổi trạng thái/nhận xử lý/phát hành tri thức thực hiện ở group và phản ánh trạng thái cho các lần báo. Nhân viên chỉ thấy lần báo của chính họ trong hội thoại, không thấy danh tính hoặc hội thoại của người khác.

## Chính sách nhận diện trùng

1. **Tự gộp an toàn:** chỉ với câu hỏi có cùng `normalized_question_key`, cùng còn mở (`new`/`in_review`) và cùng phạm vi chính sách. Key được tạo server-side từ Unicode chuẩn hóa, chữ thường, bỏ dấu câu/khoảng trắng thừa và từ đệm ổn định.
2. **Không tự gộp câu có dữ liệu định danh/ngữ cảnh cá nhân:** email, số điện thoại, mã đơn/ticket, domain, số dài hoặc mẫu định danh sẽ luôn tạo lần báo/group riêng, trừ khi chuyên gia chủ động gộp.
3. **Gần giống về ngữ nghĩa:** không tự gộp ở phiên bản đầu vì có rủi ro gộp nhầm vấn đề nghiệp vụ. UI chỉ đề xuất “Có thể trùng” cho chuyên gia dựa trên tìm kiếm tương đồng; chuyên gia quyết định gộp thủ công. Chỉ triển khai sau khi có bộ dữ liệu đánh giá và ngưỡng được nghiệm thu.
4. **Không gộp vào group đã đóng:** câu hỏi lặp lại sau khi đã có đáp án/tri thức sẽ đi qua retrieval bình thường; nếu vẫn cần chuyên gia, tạo group mới để tránh mở lại lịch sử cũ một cách âm thầm.

## Luồng mong muốn

```text
Agent không thể phản hồi an toàn
  → tạo key và kiểm tra group còn mở (atomic)
  → có group: ghi thêm lần báo, tăng số người gặp
       ↳ chat: “Đã bổ sung vào yêu cầu chuyên gia đang xử lý vì …”
  → chưa có: tạo group + lần báo đầu tiên
       ↳ chat: “Đã tạo yêu cầu chuyên gia vì …”
  → chuyên gia xử lý một group; kết quả/trạng thái đến từng người đã báo
```

## Phạm vi triển khai

1. **Chuẩn hóa cấu hình quyết định phản hồi**
   - Giữ **Tự trả lời** và **Chủ đề nhạy cảm** là hai ngưỡng trực tiếp quyết định Agent có tự trả lời hay chuyển chuyên gia.
   - Bỏ ô UI có tên “Trả lời một phần”: Agent đã không còn nhánh trả lời một phần, nên ngưỡng này không được biểu diễn như một hành vi đang bật.
   - Giữ `partial_answer_threshold` trong database/log tương thích ở giai đoạn đầu; đổi mục đích thành phân loại ưu tiên yêu cầu: dưới ngưỡng là “thiếu căn cứ đáng tin cậy”, từ ngưỡng đến dưới tự trả lời là “có căn cứ nhưng chưa đủ an toàn”. Không dùng nó để tạo câu trả lời một phần.

2. **Migration và backfill không mất dữ liệu**
   - Tạo `expert_request_groups`, thêm `group_id`, `normalized_question_key` vào `unanswered_questions` và index cho group mở/key.
   - Backfill từng ticket cũ vào một group; chỉ gộp ticket cũ có exact key, còn mở, không chứa định danh. Không xóa ticket, review hoặc liên kết tin nhắn.
   - Dùng foreign key và transaction; có migration rollback cho phần schema nếu chưa chạy backfill.

3. **Tạo yêu cầu chống race condition**
   - Đưa việc tìm/tạo group vào một service/transaction dùng unique partial index hoặc advisory transaction lock theo key phạm vi.
   - Cả endpoint tự động của Agent và endpoint yêu cầu thủ công phải gọi chung service; unique `source_message_id` vẫn giữ để bảo vệ retry cùng tin nhắn.
   - API trả về `created | joined`, `groupId`, số lượt báo và lý do để chat diễn đạt đúng thực tế.

4. **Workspace, dashboard và RBAC**
   - API danh sách dành cho technical/admin trả group thay vì occurrence; detail trả ngữ cảnh và danh sách lần báo theo quyền.
   - Dashboard đếm số group đang mở, đồng thời có chỉ số phụ “lượt báo” để không che giấu mức ảnh hưởng.
   - Sales không truy cập danh sách chung; conversation API chỉ trả group status/count ở mức an toàn cho chính người gửi.

5. **Xử lý group và thông báo kết quả**
   - Nhận xử lý, gán chuyên gia, phản hồi riêng, xuất bản tri thức và đóng có lý do được ghi audit tại group.
   - Khi hoàn tất, cập nhật các occurrence liên quan và đưa trạng thái/kết quả phù hợp trở lại hội thoại từng người báo.
   - Chi tiết group hiển thị “lần báo” như bằng chứng vận hành, không biến các câu hỏi giống nhau thành một bản ghi mất nguồn gốc.

6. **Nghiệm thu**
   - Hai người hỏi câu giống hệt khi group còn mở → một dòng group, hai occurrence, count = 2; không có race khi gửi đồng thời.
   - Cùng một câu có mã đơn/email → không tự gộp.
   - Group đóng rồi hỏi lại → group mới khi vẫn cần expert.
- Sales chỉ xem trạng thái của mình; technical/admin xem aggregate/detail theo permission.
- Dashboard và sidebar count đúng theo group, không theo số dòng occurrence; deep link cũ vẫn chuyển đúng group tương ứng.
- Cài đặt không còn hiển thị “Trả lời một phần”; thay đổi ngưỡng tự trả lời/chủ đề nhạy cảm phải dẫn đến đúng nhánh Agent.

## Rủi ro và cách kiểm soát

- **Gộp nhầm** làm chuyên gia bỏ sót ngữ cảnh: auto-group exact-only và chặn dữ liệu định danh; semantic matching chỉ là gợi ý.
- **Hai request đến cùng lúc** tạo hai group: dùng ràng buộc/index + transaction thay vì kiểm tra rồi insert rời rạc.
- **Lộ thông tin giữa nhân viên:** không trả danh sách người hỏi, hội thoại hay nội dung riêng cho sales.
- **Migration làm sai số liệu lịch sử:** backup trước migration, báo cáo số group/occurrence trước-sau và giữ khóa tham chiếu cũ.

## Quyết định còn mở

- Chưa chốt thời hạn window cho “gần giống”: đề xuất chưa đặt window cho exact question khi group còn mở; group đã đóng luôn không gộp.
- Chưa triển khai gửi email/Slack khi có kết quả; in-app/conversation status là kênh đầu tiên.
- Gộp thủ công câu gần giống sẽ là phase sau, sau khi workspace có assignment và phản hồi riêng theo plan workflow hiện hành.
