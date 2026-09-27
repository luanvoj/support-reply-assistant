# Lọc thời gian và phân trang Nhật ký vận hành

> Trạng thái 28/09/2026: Đã triển khai API filter server-side, quick range/tùy chọn, tổng phân trang và responsive toolbar. Đã xác minh bằng typecheck, diff check và build; browser/RBAC nghiệm thu thủ công còn chờ.

## Kết quả mong đợi

- Admin có thể lọc Nhật ký vận hành theo loại thao tác và khoảng thời gian rõ ràng: hôm nay, 7 ngày, 30 ngày, khoảng tùy chọn hoặc toàn bộ thời gian.
- Danh sách phân trang nhất quán: tổng kết quả, trang hiện tại, CTA Trước/Sau và trạng thái disabled chính xác; thay đổi filter luôn quay về trang 1.
- Khoảng thời gian được áp dụng ở server, không lọc cục bộ trên một trang 30 dòng; timezone hiển thị theo `Asia/Saigon`, còn truy vấn dùng mốc ISO UTC có biên ngày bao gồm cả ngày kết thúc.

## Hiện trạng và nguyên nhân

Trước cập nhật, `GET /api/operational-logs` chỉ nhận `page` và `category`, luôn giới hạn 30 dòng. UI đã có phân trang cơ bản nhưng thiếu tổng kết rõ ràng và không có filter thời gian. Các điểm này đã được triển khai theo trạng thái ở đầu kế hoạch.

## Impact map

| Liên kết | Xử lý |
| --- | --- |
| Runtime/API | Bổ sung query `from`, `to`, `pageSize`; validate ISO date, thứ tự ngày và giới hạn page size ở server. |
| Persistence | Không cần migration: `operational_logs.created_at` đã có index giảm dần; đánh giá bổ sung composite index `(category, created_at DESC)` đã có sẵn. |
| Cấu hình | Retention không đổi; filter thời gian chỉ ảnh hưởng truy vấn hiển thị, không thay đổi dữ liệu hay job dọn log. |
| RBAC | Giữ `requireRole("admin")` cho list API; không trả metadata chat/secret. |
| UI/CTA | Thêm quick range và date range tùy chọn; reset trang khi filter đổi; pagination hiển thị tổng dòng/khoảng dòng và CTA disabled đúng. |
| Chỉ số/tài liệu | Không đưa log vào Dashboard. Cập nhật API contract với query mới và Hướng dẫn sử dụng phần Log. |
| Kiểm thử | Test boundary đầu/cuối ngày, ngày kết thúc bao gồm, range ngược/invalid, category kết hợp range, trang vượt tổng, Admin/non-Admin và responsive. |

## Kế hoạch triển khai

1. Chuẩn hóa contract `GET /api/operational-logs`: `category`, `from`, `to`, `page`, `pageSize`; reject date sai hoặc range ngược bằng 400; query/count dùng cùng điều kiện.
2. Mở rộng `OperationalLogSettings`: quick filters “Hôm nay / 7 ngày / 30 ngày / Tùy chọn / Toàn bộ”, input ngày khi tùy chọn, state request/loading/empty nhất quán và reset page khi filter đổi.
3. Hoàn thiện footer phân trang: “Hiển thị X–Y / N hoạt động”, trang hiện tại/tổng trang, CTA Trước/Sau; không hiển thị footer khi chỉ một trang.
4. Rà CSS desktop/mobile theo settings toolbar hiện có; date controls không làm lệch CTA retention, màn hẹp xếp dọc theo thứ tự lọc → retention → CTA.
5. Chạy typecheck, migration không cần thiết, API smoke cho các tổ hợp filter và browser nghiệm thu theo viewport/RBAC; cập nhật `docs/API.md`, hướng dẫn và memory bằng bằng chứng.

## Rủi ro và quyết định

- Không dùng `toLocaleString()` để tạo query date vì lệch timezone trình duyệt/server; client gửi date-only, server chuẩn hóa ranh giới ngày `Asia/Saigon` hoặc UI gửi ISO UTC rõ ràng.
- Không thêm tìm kiếm toàn văn trong phạm vi này để tránh mở rộng log metadata/PII. Có thể lập kế hoạch riêng nếu cần.
