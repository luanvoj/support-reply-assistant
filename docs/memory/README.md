---
memory-format: v1
---

# Bộ nhớ dự án

Đây là trạng thái gọn dành cho Agent tiếp tục công việc. Đọc `INDEX.md` trước, sau đó chỉ đọc module và plan liên quan.

## Nguyên tắc bằng chứng

- Mọi thông tin phản hồi cho người dùng phải được kiểm tra và có bằng chứng trong phạm vi đã khảo sát.
- Khi chưa đủ bằng chứng, phải ghi rõ là **chưa xác minh** hoặc nêu giả thuyết có điều kiện; không diễn đạt suy đoán như sự thật.
- Không tự suy ra trạng thái cấu hình, nguyên nhân lỗi hoặc kết quả vận hành chỉ từ một thông báo chung của UI. Nêu nguồn kiểm tra, phạm vi và giới hạn của kết luận khi điều đó có ý nghĩa.
- Mỗi thay đổi chức năng phải rà mối liên kết với cấu hình, API, persistence, RBAC, UI/CTA, chỉ số, tài liệu và kiểm thử. Cấu hình hoặc CTA không còn điều khiển hành vi thật phải được sửa, bỏ hoặc ghi nhận hoãn rõ ràng.

- `modules/`: quyết định còn hiệu lực, contract, rủi ro và việc mở theo module.
- `plans/`: checklist nguồn sự thật của công việc đang chạy.
- `archive/`: kế hoạch đã khép; không dùng làm trạng thái hiện hành.

Không sao chép README/API/Deployment vào đây. `docs/archive/2026-09/legacy-development-log.md` là evidence legacy; không dùng làm trạng thái hiện hành.
