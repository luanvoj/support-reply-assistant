# Kế hoạch: bố cục xử lý Yêu cầu chuyên gia theo Kho kiến thức

## Kết quả mong đợi

`/unanswered` trở thành workspace một cột, cùng mô hình với Kho kiến thức: danh sách là nền chính; khi bấm **Xử lý**, một vùng xử lý đầy đủ xuất hiện **phía trên danh sách** và được cuộn/focus vào viewport. Không còn panel chi tiết bên phải hay empty-state làm hẹp bảng.

## Hiện trạng đã xác minh

- `QueueScreen` đã có state `selectedId`, `selectedTicket`, deep link `?id=<uuid>&page=<n>`, tìm kiếm/phân trang server-side, publish và hard-delete ticket `new` chưa review.
- `GET /api/unanswered` đã trả đủ câu hỏi, lý do, điểm tin cậy, người tạo, trạng thái và ticket được chọn. Publish tiếp tục dùng `POST /api/unanswered/:id/review`; xóa dùng `DELETE /api/unanswered/:id`.
- CSS hiện dùng `.expert-request-workspace` hai cột, giới hạn vùng danh sách khi có selection. Đây là nguyên nhân trực tiếp khiến sáu cột của bảng bị chật.
- Kho kiến thức đã dùng pattern editor mở phía trên danh sách; plan này chỉ tái dùng pattern điều hướng đó, không sao chép UI hoặc thay đổi contract nghiệp vụ.

## Thiết kế đích

```text
Yêu cầu chuyên gia
  [Làm mới]

  (chỉ khi đã chọn ticket)
  ┌─ Xử lý yêu cầu ─────────────────────────────────────────────┐
  │ câu hỏi đầy đủ · lý do · metadata                             │
  │ tiêu đề tri thức · câu trả lời đã xác nhận                    │
  │ [Đóng xử lý] [Xóa yêu cầu] [Bổ sung tri thức & đóng yêu cầu] │
  └─────────────────────────────────────────────────────────────┘

  ┌─ Danh sách yêu cầu ─────────────────────────────────────────┐
  │ tìm kiếm · bảng 6 cột · phân trang                           │
  └─────────────────────────────────────────────────────────────┘
```

- Khi không chọn ticket: chỉ hiển thị danh sách toàn chiều rộng, không có placeholder trống.
- Khi chọn: panel xử lý nằm sau page header và trước danh sách. Heading hoặc trường tiêu đề được focus; `scrollIntoView({ block: "start" })` chỉ chạy sau khi ticket đã được tải/render.
- Bảng giữ đủ sáu cột `Câu hỏi | Độ tin cậy | Nguyên nhân | Người tạo | Trạng thái | Hành động`; câu hỏi, lý do và người tạo vẫn ellipsis/tooltip theo giới hạn hiện tại. Chiều rộng tăng trở lại vì không chia cột với detail.
- `Đóng xử lý` chỉ đóng form, xóa `id` khỏi URL và giữ trang hiện tại. Publish/xóa thành công đóng form, tải lại danh sách; thông báo success/error hiện có được giữ.

## Liên kết chức năng

| Liên kết | Quyết định |
| --- | --- |
| Data/API | Giữ nguyên `GET /api/unanswered`, `POST /review`, `DELETE /:id`; không thêm request hay field. |
| Persistence/migration | Không đổi schema hoặc migration. |
| RBAC | Không đổi: xem cần `ticket:read`; publish cần `knowledge:write`; xóa cần `ticket:write`, vẫn được server kiểm tra. |
| URL/state | Giữ `id`/`page` để deep link vẫn mở đúng form; selection không còn điều khiển layout hai cột. |
| CTA/trạng thái | `Xử lý` mở form; `Đóng xử lý` đóng form; `Xóa yêu cầu` chỉ với `new`; publish giữ validation title/answer. Không giữ CTA hoặc empty state mô tả panel phải đã bị bỏ. |
| Dashboard/chỉ số | Không đổi query metric. Sau xóa, dashboard phản ánh ở lần tải kế tiếp như hiện tại. |
| Tài liệu | Cập nhật API chỉ khi contract đổi (hiện không đổi); cập nhật memory plan/INDEX và mô tả UI nếu có tài liệu hướng dẫn nhắc layout cũ. |

## Các bước triển khai

1. Refactor `QueueScreen` trong `components/operations.tsx`: render processing editor có điều kiện trước list, bỏ markup detail/empty-state bên phải, giữ nguyên handlers `open`, `close`, `publish`, `deleteNewTicket` và dữ liệu selection.
2. Thêm ref/effect cho processing editor: chỉ sau render của ticket đã chọn mới scroll/focus; deep link lúc tải trang áp dụng cùng hành vi. Không tự cuộn khi reload list hoặc khi đóng form.
3. Thay CSS `.expert-request-workspace` bằng container một cột cùng width với workspace Kho kiến thức; thêm style editor trên-list, header/actions responsive; bỏ các grid/sticky/empty style không còn dùng. Giữ table fixed-layout sáu cột và ellipsis.
4. Rà UI/CTA/ràng buộc: form selected mới mở delete; publish disabled cho đến khi hợp lệ; action close/publish/delete trả list về state đúng, không để selection/URL cũ.
5. Kiểm tra typecheck/build, deep-link, desktop/tablet/mobile screenshot và hành vi keyboard/focus; không coi build là nghiệm thu UI thay cho viewport thật.

## Tiêu chí nghiệm thu

- Bấm `Xử lý` từ bất kỳ trang danh sách nào mở đúng ticket trong form trên cùng, trong viewport, không còn detail panel bên phải.
- Bấm `Đóng xử lý` quay về danh sách toàn chiều rộng, giữ trang hiện tại; URL không còn `id`.
- Mở `/unanswered?id=<ticket>&page=<n>` render form đúng ticket kể cả ticket ngoài trang đó.
- Bảng sáu cột không bị hẹp bởi selection; mọi heading một dòng, dữ liệu dài không làm vỡ layout.
- Publish/xóa vẫn bị kiểm tra ở server và sau thành công không giữ form stale; list, pagination và toast đúng.
- Ở 1024px, 768px, 375px không có panel phải trống, không có cuộn ngang không cần thiết, thứ tự focus form → list hợp lý.

## Rủi ro / quyết định còn mở

- Native `title` tooltip chỉ hiện khi hover; label truy cập vẫn cần giữ cho button. Không thêm custom tooltip nếu chưa có nhu cầu accessibility riêng.
- Chưa có browser session để xác minh screenshot hiện tại; nghiệm thu viewport và keyboard là NOT-RUN cho đến khi có phiên đăng nhập.
- Đây là thay đổi layout/flow UI, không mở rộng các trạng thái nghiệp vụ còn thiếu như assignment hay private reply.
