# Loại bỏ CTA gộp từng bài, giữ an toàn Smart Merge theo đợt

> Trạng thái: đã triển khai 29/09/2026 — đã gỡ CTA/handler gộp đơn lẻ trên route active; endpoint và luồng batch được giữ nguyên.

## Kết quả mong đợi

- Danh sách bài viết tại `/knowledge-base` không còn CTA **Gộp** ở từng dòng; người dùng chỉ khởi tạo gộp từ **Gộp bài tương tự** theo đợt.
- Smart Merge theo đợt vẫn tạo nháp, gắn kết quả vào batch, mở đối chiếu và duyệt/từ chối bình thường.
- Không thay đổi dữ liệu merge hiện có, schema, RBAC, trạng thái draft/approved/rejected hay API contract công khai đang dùng nội bộ.

## Hiện trạng đã xác minh

- Route active `app/knowledge-base/page.tsx` render `components/screens/knowledge-screen.tsx`.
- Nút trên từng hàng published gọi `suggestMerge(item)`; đây là consumer UI đơn lẻ duy nhất trong màn hình active.
- Cùng endpoint `POST /api/knowledge/merge/suggest` được `generateSelectedMerges` gọi cho từng candidate của batch. Vì vậy xóa route, schema request/response hoặc logic tạo draft sẽ làm CTA **Tạo bản nháp gộp** theo đợt lỗi.
- `components/operations.tsx` cũng chứa màn hình/CTA legacy nhưng hiện không được app route import. Không sửa/xóa file legacy trong thay đổi CTA active trừ khi một rà soát dependency trước khi làm chứng minh nó có consumer mới.

## Impact map

| Liên kết | Quyết định |
| --- | --- |
| UI/CTA | Gỡ button **Gộp** và handler `suggestMerge` đơn lẻ khỏi `KnowledgeScreen`; giữ button mở workspace, danh sách candidate, diff và duyệt/từ chối. |
| API/server validation | Giữ nguyên `/api/knowledge/merge/suggest`, batch routes, attach `409`, approve/reject và Agent availability guard. |
| Persistence/migration | Không migration, không xóa `knowledge_merge_runs`, sources, batches/items hay pair decisions; các bản nháp có sẵn tiếp tục được hiển thị/duyệt. |
| RBAC/config | Không đổi `knowledge:write`, Admin approval hay threshold/provider configuration. |
| Tài liệu/QA | Không xóa API documentation vì endpoint vẫn là implementation dependency. Cập nhật hướng dẫn/UI text chỉ khi còn mô tả CTA gộp từng bài; bổ sung regression case cho batch. |

## Kế hoạch triển khai

1. Chốt dependency trước sửa bằng `rg`: xác nhận entry route active, toàn bộ caller của `suggestMerge` và `/api/knowledge/merge/suggest`; ghi rõ `generateSelectedMerges` là caller bắt buộc phải giữ.
2. Tại `KnowledgeScreen`, xóa CTA hàng published và handler UI đơn lẻ, bao gồm notification/state chỉ phục vụ thao tác đó. Không chạm tới `generateSelectedMerges`, `saveMergeOutcome`, `openMergeDiff`, `decideMerge` hoặc các state batch.
3. Rà UI sau khi xóa: cột thao tác vẫn có Sửa/Lưu trữ và các CTA Duyệt gộp/Từ chối cho draft đang chờ; header **Gộp bài tương tự** là entry point duy nhất và không xuất hiện khoảng trống/cột sai căn ở desktop/mobile.
4. Rà API, persistence và documentation: giữ endpoint suggest trong `docs/API.md` với mô tả nội bộ/contract hiện có; không tạo migration hay thay API consumer. Nếu legacy `operations.tsx` không có consumer vẫn để nguyên để tránh mở rộng phạm vi; tạo task cleanup riêng nếu muốn xóa mã chết sau này.
5. Kiểm chứng regression: typecheck/build; mở workspace → quét → chọn candidate → tạo bản nháp → attach → xem đối chiếu → duyệt/từ chối; xác nhận request `POST /api/knowledge/merge/suggest` vẫn phát sinh từ batch nhưng không còn phát sinh từ danh sách bài. Kiểm tra RBAC/Agent unavailable và nhóm đã `drafted` vẫn disabled đúng.

## Rủi ro và tiêu chí dừng

- Rủi ro duy nhất đáng kể là nhầm endpoint chung thành API chỉ dành cho CTA từng bài. Không được xóa hoặc đổi request/response của endpoint trong task này.
- Không thực hiện cleanup `components/operations.tsx` cùng lúc: file không thuộc route active nhưng thay đổi rộng có thể che giấu regression. Chỉ lập cleanup sau khi có dependency audit riêng.
- Hoàn tất khi active UI không còn CTA gộp đơn lẻ, batch end-to-end còn hoạt động, và không còn nhãn/tài liệu active nào hướng người dùng tới CTA đã bỏ.
