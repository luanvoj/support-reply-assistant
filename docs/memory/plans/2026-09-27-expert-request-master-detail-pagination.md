# Kế hoạch: chuẩn hóa workspace Yêu cầu chuyên gia

## Mục tiêu

Biến màn hình Yêu cầu chuyên gia thành một workspace rõ ràng, không còn cảm giác phần chi tiết bị chèn vào cuối bảng: danh sách yêu cầu và chi tiết xử lý là hai card độc lập trong cùng route. Danh sách có tìm kiếm và phân trang thật từ server; deep link đến một yêu cầu vẫn mở đúng chi tiết.

## Hiện trạng đã xác minh

- `GET /api/unanswered` luôn lấy tối đa 100 dòng, chưa có `page`, `pageSize`, tổng số dòng hoặc tìm kiếm phía server.
- `QueueScreen` chỉ lọc mảng đã tải ở trình duyệt; vì vậy không phải phân trang và có thể bỏ sót dữ liệu ngoài 100 dòng.
- Chi tiết xử lý được render trong cùng `.ops-panel` ngay sau bảng. Vì vậy nút “Đóng chi tiết” dính vào biên dưới của danh sách, không phân định vùng làm việc.
- Quyền hiện hữu không đổi: đọc queue cần `ticket:read`; xuất bản tri thức dùng endpoint review hiện có và server tiếp tục kiểm tra quyền ghi.

## Thiết kế đích

```text
Yêu cầu chuyên gia (/unanswered)
┌──────────────────── Danh sách ───────────────────┐  ┌──────── Chi tiết xử lý ────────┐
│ Tìm kiếm · bảng · phân trang                     │  │ câu hỏi · bối cảnh · metadata  │
│ Chọn “Xử lý” để mở chi tiết                        │  │ biểu mẫu bổ sung tri thức       │
└───────────────────────────────────────────────────┘  │ đóng / lưu xử lý                 │
                                                         └────────────────────────────────┘
```

- Desktop: hai vùng độc lập, panel chi tiết neo theo viewport để vẫn thấy thao tác xử lý khi danh sách dài.
- Mobile/tablet hẹp: một cột, detail trở thành card độc lập sau danh sách; không chồng hoặc cắt nội dung.
- Chỉ giữ CTA hiện có “Bổ sung tri thức & đóng yêu cầu”; không giới thiệu trạng thái/CTA mới chưa có server contract.
- URL duy trì `?id=<ticket>` và thêm `page=<n>` để đóng/mở/refresh không làm người dùng mất trang đang xem.

## Impact map

| Liên kết | Tác động và cách xử lý |
| --- | --- |
| Runtime/API | Mở rộng GET queue với `page`, `pageSize`, `search` đã giới hạn/chuẩn hóa tại server; trả `pagination` và ticket được deep-link chọn. |
| Persistence/migration | Không đổi schema hoặc migration; chỉ đổi truy vấn đọc. |
| Cấu hình điều khiển | Không dùng cấu hình mới; ngưỡng Agent/retrieval không thay đổi. |
| RBAC | Giữ `ticket:read`; endpoint review/publish không đổi và vẫn là điểm kiểm quyền ghi. |
| UI/CTA/trạng thái | Tách card danh sách/chi tiết; CTA Đóng chỉ đóng panel và giữ trang; CTA xử lý/publish giữ ý nghĩa hiện tại. |
| Chỉ số/báo cáo | Không có metric hoặc dashboard contract bị đổi. |
| Tài liệu/kiểm thử | Cập nhật memory plan; typecheck/build, kiểm tra API pagination/search/deep link và responsive UI trong phạm vi khả dụng. |

## Các bước triển khai

1. Chuẩn hóa `GET /api/unanswered`: validate query, tìm kiếm có giới hạn, đếm tổng, `LIMIT/OFFSET`, và trả ticket deep-link riêng khi cần.
2. Refactor `QueueScreen`: nạp dữ liệu theo page/search, giữ deep link và selection ổn định, bổ sung điều khiển Trước/Sau.
3. Tách master–detail thành hai card; thiết kế header detail, ngữ cảnh/lý do, metadata, form và footer action theo token sẵn có; thêm breakpoint một cột.
4. Kiểm tra liên kết: endpoint review sau refresh, RBAC compile path, typecheck/build. Nghiệm thu browser theo desktop/mobile cần chạy ở phiên có browser session.

## Tiêu chí nghiệm thu

- Có hơn một trang dữ liệu thì tìm kiếm và điều hướng không bỏ sót ticket ngoài trang đầu.
- Bấm “Xử lý” mở detail trong card riêng; bấm “Đóng” chỉ đóng detail và giữ nguyên query/trang danh sách.
- Mở `/unanswered?id=<id>&page=<n>` hiển thị được ticket dù ticket không nằm trong page hiện hành.
- Publish thành công làm mới danh sách, đóng detail và không để CTA/trạng thái cũ sai nghĩa.
- Bố cục không tràn/cắt tại desktop và breakpoint hẹp; typecheck/build không lỗi.

## Trạng thái triển khai

- PASS — `GET /api/unanswered` có phân trang, tổng số, tìm kiếm server-side có giới hạn 100 ký tự và giới hạn page/pageSize; `id` chỉ được dùng khi đúng định dạng UUID.
- PASS — deep link giữ `id` và `page`; API trả ticket được chọn độc lập với page hiện tại để không mất detail khi ticket không ở trang đang xem.
- PASS — workspace hiển thị list/detail là hai card độc lập; detail có header/đóng, metadata, lý do và vùng xuất bản tri thức; breakpoint hẹp đổi sang một cột.
- PASS — `npm run typecheck`, `npm run build`, `git diff --check`.
- NOT-RUN — browser/RBAC end-to-end với phiên đăng nhập thật; cần nghiệm thu thao tác chọn/đóng/tìm kiếm/phân trang ở desktop và mobile.

## Rủi ro và phần chưa mở rộng

- Chưa thêm nhận phiếu, phân công hay phản hồi riêng vì các trạng thái/endpoint này chưa hoàn chỉnh trong contract hiện tại.
- Browser/RBAC end-to-end cần phiên browser đã đăng nhập nên sẽ được ghi rõ nếu chưa chạy được tại phiên này.
