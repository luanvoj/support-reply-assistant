# Kế hoạch: hợp nhất luồng Yêu cầu chuyên gia

## Mục tiêu

Biến hàng đợi từ một bảng lỗi tách rời thành vòng lặp vận hành tri thức rõ ràng: nhân viên yêu cầu hỗ trợ, chuyên gia tiếp nhận và phản hồi, sau đó chỉ bổ sung Kho kiến thức khi câu trả lời có giá trị tái sử dụng.

## Vấn đề đã xác minh

- `sales` chỉ có `chat:use`, `conversation:read`, `knowledge:read`, `feedback:create`; không có `ticket:read`, `ticket:write` hay `knowledge:write`.
- Sidebar hiện ẩn Hàng đợi cho `sales`, nhưng CTA từ Trợ lý đang dẫn trực tiếp tới `/review?id=...`; route này đòi `knowledge:write`, nên luồng bị đứt quyền.
- `/unanswered` và `/review` là hai màn hình cho cùng một việc; `/review` chỉ mở một phiếu và không có bối cảnh danh sách/điều hướng quay lại.
- Phát hành từ review tạo `knowledge_articles.status='published'` nhưng chưa đặt `is_verified=true`. Khi `verifiedOnly` mặc định bật, bài mới có thể không được truy xuất ở lần hỏi sau.
- Model dữ liệu có `new`, `in_review`, `answered`, `published`, `rejected`, nhưng UI hiện chỉ hiển thị `new` rõ ràng và không có thao tác nhận phiếu/đang xử lý.

## Quyết định đề xuất

Đổi tên nghiệp vụ và sidebar từ **Hàng đợi chưa trả lời** thành **Yêu cầu chuyên gia**. Đây không phải nơi lưu mọi câu hỏi AI không trả lời, mà là hộp công việc cần người có chuyên môn chịu trách nhiệm.

### Quy tắc trả lời hai nhánh (đã chốt)

Loại bỏ nhánh nghiệp vụ “trả lời một phần” và CTA yêu cầu chuyên gia thủ công trong chat. Sau khi retrieval/evidence hoàn tất, Agent chỉ có một trong hai kết quả:

1. **Có thể phản hồi:** đủ căn cứ theo ngưỡng đang cấu hình và chính sách nguồn cho phép trả lời. Trợ lý trả lời kèm thông tin minh bạch cho nhân viên: mức tin cậy, số nguồn/căn cứ và cảnh báo chính sách nếu có. Đây là thông tin để nhân viên quyết định dùng câu trả lời khi tư vấn khách hàng, không phải một ticket.
2. **Chưa thể phản hồi an toàn:** không có tài liệu phù hợp, độ tin cậy dưới ngưỡng, hoặc nguồn có chính sách bắt buộc chuyên gia xác nhận. Hệ thống tự tạo một Yêu cầu chuyên gia, không đưa ra câu trả lời suy đoán; phản hồi trong chat phải nêu lý do thật và trạng thái đã chuyển, ví dụ “Không tìm thấy tài liệu phù hợp trong Kho kiến thức” hoặc “Độ tin cậy 42%, thấp hơn ngưỡng 80%”.

Lỗi hạ tầng/AI provider là lỗi kỹ thuật, không phải một nhánh quyết định tri thức: hiển thị trạng thái thử lại, không tự tạo yêu cầu chuyên gia chỉ vì provider tạm lỗi.

### Trải nghiệm theo vai trò

| Vai trò | Thấy gì | Có thể làm gì |
| --- | --- | --- |
| Người dùng (`sales`) | Trạng thái ngay trong hội thoại và danh sách yêu cầu của chính mình | Gửi yêu cầu, bổ sung ngữ cảnh, xem tiến độ và câu trả lời cuối |
| Chuyên gia (`technical`) | Một màn hình Yêu cầu chuyên gia duy nhất | Nhận xử lý, trả lời, yêu cầu thêm thông tin, chuyển thành tri thức đã xác minh |
| Quản trị viên (`admin`) | Cùng workspace chuyên gia, có toàn quyền | Điều phối, chuyển người xử lý, xem tất cả và cấu hình SLA |

### Một route, hai vùng làm việc

Giữ một route `/expert-requests` thay cho cặp `/unanswered` + `/review`:

```text
Danh sách yêu cầu (bộ lọc + ưu tiên)  |  Chi tiết yêu cầu đang chọn
                                      |  ngữ cảnh hội thoại, căn cứ, tác vụ xử lý
```

Deep link từ dashboard/chat chỉ mở đúng yêu cầu trong panel chi tiết của route này. Không tạo một màn hình “Rà soát kỹ thuật” độc lập.

### Trạng thái và tác vụ tối giản

```text
Mới → Đang xử lý → [Đã phản hồi riêng | Đã bổ sung tri thức | Đóng / không xử lý]
```

- **Mới:** có lý do, độ tin cậy, câu hỏi và ngữ cảnh nguồn.
- **Đang xử lý:** chuyên gia nhận phiếu; hiển thị người phụ trách và thời gian nhận.
- **Đã phản hồi riêng:** trả lời nhu cầu cụ thể, không biến mọi câu trả lời thành bài viết.
- **Đã bổ sung tri thức:** tạo bài viết, chunk và đặt `is_verified=true`; đáp án được dùng lại ở lần sau.
- **Đóng / không xử lý:** có lý do bắt buộc, tránh phiếu biến mất không dấu vết.

## Giá trị vận hành bổ sung

1. **Bối cảnh đủ để xử lý:** hiển thị câu hỏi gốc, đoạn hội thoại liên quan, lý do escalation, điểm/căn cứ retrieval và nguồn gần nhất.
2. **Triage thực sự:** ưu tiên theo chính sách nhạy cảm, số người gặp cùng vấn đề, tuổi phiếu và mức ảnh hưởng; hỗ trợ lọc “Của tôi”, “Chưa nhận”, “Quá hạn”.
3. **Không tạo tri thức rác:** chuyên gia có hai đích rõ ràng: phản hồi riêng hoặc đóng góp cho Kho kiến thức.
4. **Đo hiệu quả:** thời gian tiếp nhận, thời gian xử lý, tỷ lệ chuyển thành tri thức, tỷ lệ câu hỏi lặp lại sau khi xuất bản và số phiếu mở theo chủ đề.
5. **Khép vòng cho người gửi:** họ thấy “Đã nhận”, “Chuyên gia đang xử lý”, “Đã có phản hồi” ngay trong hội thoại; không cần quyền vào queue toàn cục.

## Phạm vi triển khai

1. Chuẩn hóa Agent decision thành hai nhánh; chuyển `partial`, insufficient evidence và policy `escalate` thành yêu cầu chuyên gia tự động; giữ provider error là retry kỹ thuật.
2. Chuẩn hóa contract API/data: assignment, timestamps, status transition có kiểm quyền; sửa publish để tạo bài verified và có audit.
3. Thay `/unanswered` + `/review` bằng workspace chuyên gia một route; giữ redirect tương thích cho link cũ.
4. Đổi CTA trong chat/dashboard theo role: sales chỉ xem trạng thái yêu cầu của mình; technical/admin mở request detail.
5. Bổ sung phản hồi tới người gửi và chỉ số vận hành tối thiểu.
6. Migrate dữ liệu cũ không mất ticket hoặc review; kiểm thử RBAC, trạng thái, publish/retrieval và deep link.

## Trạng thái triển khai

- PASS — Agent mới không còn tạo nhánh trả lời một phần: căn cứ không đủ hoặc policy `partial`/`escalate` đều tạo yêu cầu chuyên gia tự động; provider lỗi vẫn là lỗi thử lại kỹ thuật.
- PASS — Thông báo fallback trong hội thoại nêu lý do cụ thể: thiếu tài liệu, độ tin cậy dưới ngưỡng hoặc cần chuyên gia xác nhận.
- PASS — Sidebar và workspace đổi tên thành **Yêu cầu chuyên gia**; deep link `/review?id=…` cũ redirect sang `/unanswered?id=…`.
- PASS — Chọn một yêu cầu từ danh sách mở chi tiết xử lý trên cùng route `/unanswered`; phát hành tạo bài `published` và `is_verified=true` để có thể truy xuất khi verified-only bật.
- NOT-RUN — Nghiệm thu browser/RBAC theo từng vai trò và kiểm thử truy xuất bài được phát hành.
- OPEN — Assignment, phản hồi riêng và trạng thái `in_review`/đóng có lý do cần hoàn tất ở vòng mở rộng tiếp theo; UI hiện chỉ hỗ trợ nhánh bổ sung tri thức.

## Tiêu chí nghiệm thu

- Sales không thể vào workspace chuyên gia nhưng luôn xem được yêu cầu của chính mình trong hội thoại.
- Một câu hỏi chỉ nhận **câu trả lời có căn cứ** hoặc **xác nhận đã chuyển chuyên gia với lý do cụ thể**; không còn câu trả lời một phần.
- Technical/admin hoàn tất xử lý trên cùng một workspace, không bị chuyển sang route độc lập.
- Mọi transition có người thực hiện, thời điểm và lý do khi đóng.
- “Đã bổ sung tri thức” tạo bài published + verified, có chunk và truy xuất được khi `verifiedOnly` bật.
- Một câu hỏi được liên kết tối đa một yêu cầu; dashboard chỉ đếm trạng thái mở `new`/`in_review`.

## Quyết định còn mở

- SLA/độ ưu tiên cụ thể theo phòng ban.
- Chuyên gia có thể chuyển phiếu cho chuyên gia khác hay chỉ Admin được làm việc này.
- Cách gửi thông báo khi có phản hồi: in-app trước, email/Slack sau khi có integration contract.
