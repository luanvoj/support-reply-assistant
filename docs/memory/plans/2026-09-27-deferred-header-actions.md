# Tạm ẩn tìm kiếm và thông báo ở header

## Quyết định đang có hiệu lực

Tạm ẩn hai control tại header của shell vận hành:

- Tìm kiếm toàn hệ thống.
- Thông báo.

Lý do: tại thời điểm 2026-09-27, ô tìm kiếm chưa truy vấn hay điều hướng tới dữ liệu; nút thông báo chỉ hiển thị feedback tĩnh. Hai control này không được hiển thị như một khả năng sản phẩm khi chưa có tác dụng thực tế.

## Bằng chứng code trước khi ẩn

- `components/operations.tsx`: `.ops-search` chỉ chứa input không có state, handler, request hay kết quả tìm kiếm.
- `components/operations.tsx`: `.header-notification` chỉ gọi `notify("Bạn đang không có thông báo mới.")`, không đọc hay thay đổi dữ liệu thông báo.

## Điều kiện để đưa trở lại

1. Tìm kiếm: chốt phạm vi dữ liệu, quyền truy cập/RBAC, API hoặc index, trạng thái loading/empty/error, điều hướng kết quả và hành vi bàn phím.
2. Thông báo: có nguồn sự kiện, trạng thái đã đọc/chưa đọc, phân quyền, danh sách hoặc panel, và hành vi khi không có thông báo.
3. Cả hai: thêm test API/UI và rà lại kích thước header, responsive, focus state theo system design trước khi bỏ trạng thái ẩn.

## Trạng thái

- Đã ẩn markup header; CSS dùng chung được giữ lại vì có thể đang phục vụ control ở màn hình khác.
- Chưa có API, data model hay UI flow được chấp thuận để khôi phục hai chức năng này.
