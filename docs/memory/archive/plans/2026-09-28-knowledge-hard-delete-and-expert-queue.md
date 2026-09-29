# Xóa vĩnh viễn tri thức và đóng hàng đợi chuyên gia

## Mục tiêu đã chốt

Khi người có quyền đã xác nhận **Xóa vĩnh viễn**, bài tri thức phải được xóa thật, kể cả khi nó từng được trích dẫn, được tạo từ Yêu cầu chuyên gia, import hoặc gộp bài. Không dùng liên kết lịch sử để phủ quyết ý chí xóa. Nhật ký vận hành chỉ giữ metadata tối thiểu của thao tác xóa; không giữ lại nội dung bài, chunk/vector hoặc bản sao câu trả lời để thay thế bài đã xóa.

Đồng thời, bảng **Yêu cầu chuyên gia** chỉ là hàng đợi công việc mở. Ticket `published`, `answered` hoặc `rejected` không được xuất hiện hay bị đếm là “cần xử lý”.

## Hiện trạng và nguyên nhân đã xác minh

- `DELETE /api/knowledge/articles/:id?permanent=true` chặn trước nếu `messages.retrieval_summary` có `articleId`, trái với yêu cầu hard-delete.
- `question_reviews.published_article_id` tham chiếu `knowledge_articles` bằng FK mặc định `RESTRICT`; một bài xuất bản từ ticket vì vậy không thể bị xóa.
- Các tham chiếu khác cũng có thể chặn xóa: `knowledge_import_rows.article_id`, `knowledge_merge_runs.merged_article_id`, `knowledge_merge_sources.article_id`, và self-reference `knowledge_articles.replaced_by`. Một số phụ thuộc (chunk/tag/audit/pair decision) đã cascade nhưng không đủ để hard-delete toàn bộ trường hợp.
- UI chỉ hiện lỗi chung vì route không thực hiện teardown có transaction hay chuyển lỗi constraint thành contract rõ ràng.
- Queue UI gọi `GET /api/unanswered` không có filter; route trả mọi status nên ticket `published` vẫn nằm trong bảng và bị đếm. Dashboard lại chỉ đếm `new`/`in_review`, tạo hai định nghĩa khác nhau về hàng đợi.

## Impact map

| Liên kết | Xử lý |
| --- | --- |
| Runtime/API | Hard-delete trở thành transaction idempotent, khóa bài trước khi xóa, gỡ mọi dependency quan hệ và trả `204/200` rõ ràng; bỏ nhánh `409` vì citation. `GET /api/unanswered` có scope hàng đợi mở mặc định/explicit, vẫn hỗ trợ status lịch sử khi cần. |
| Persistence/migration | Đồng bộ schema mới và migration nâng cấp DB đang có: thay FK blocker bằng `SET NULL`/`CASCADE` phù hợp, đồng thời teardown chủ động các record gộp/import để không còn run/row mồ côi hoặc metadata trỏ ID đã mất. Xóa cascade chunk, tag, audit và pair-decision. |
| Cấu hình | Không có setting nào điều khiển quyền xóa hay scope queue; không thêm config chết. Retention của Operational Log giữ nguyên và là nơi duy nhất ghi dấu vết metadata của thao tác. |
| RBAC | Giữ `knowledge:write` cho archive/restore/hard-delete theo contract hiện hữu; server xác thực cả archive status và confirmation token/request trước khi mutating. Không tin UI. |
| UI/CTA/trạng thái | CTA Xóa ở Đã lưu trữ phải thành công cho mọi bài hợp lệ; sau thành công refresh danh sách, tổng số và selection. Lỗi thực tế hiển thị được, không còn copy “hãy lưu trữ để bảo toàn lịch sử”. Queue mặc định chỉ có ticket mở; status label tiếng Việt đồng bộ với enum nếu có lịch sử/selected deep link. |
| Báo cáo/chỉ số | Dashboard `unanswered_open` và queue dùng cùng tập `new`, `in_review`; số bài published giảm ngay sau purge. Operational Log thêm action `knowledge_article_hard_deleted`, chỉ chứa ID, title snapshot, trạng thái/dependency count — tuyệt đối không chứa markdown/chunk/chat. |
| Tài liệu | Cập nhật API, README/hướng dẫn và memory: archive là reversible; hard-delete là cuối cùng và không bị citation/ticket/import/merge giữ lại. Nêu rõ ticket đóng không thuộc hàng đợi. |
| Kiểm thử | Thêm/điều chỉnh integration smoke cho mọi loại dependency, RBAC, error/idempotency, queue scope và browser acceptance. |

## Kế hoạch triển khai

1. **Chốt contract xóa và lập bản đồ dependency thực tế.** Rà FK trong database live (`pg_constraint`) trước migration, đối chiếu schema init và các bảng import/gộp/review/retrieval. Quy ước hard-delete chỉ chấp nhận bài `archived` (đúng CTA hiện tại); khi đã xác nhận, không còn bất kỳ điều kiện citation/lineage nào trả `409`. Hai lần bấm/delete retry sau thành công trả kết quả idempotent (không lỗi 500).

2. **Migration an toàn cho DB đang dùng và schema mới.** Trong `scripts/migrate.ts`, thay từng FK blocker bằng hành vi đúng contract, kèm `ALTER ... DROP/ADD CONSTRAINT` có kiểm tra tên constraint. Đồng bộ `db/init/002_schema.sql`. Với dependency cần giữ record, dùng `ON DELETE SET NULL`; với record chỉ có ý nghĩa cùng bài (chunk/tag/audit/pair decision và relation source phù hợp), dùng `ON DELETE CASCADE` hoặc cleanup transaction. Sửa `replaced_by` để xóa bài gộp không giữ nguồn bị archive trong trạng thái trỏ mồ côi. Không xóa nội dung người dùng ngoài đúng article và các bản sao review được xác định là nội dung của article đã purge.

3. **Viết lại server hard-delete theo một transaction.** Lock article, yêu cầu bài đang archived, lấy metadata không nhạy cảm để log; gỡ/cascade quan hệ review, import và merge theo thứ tự đã kiểm chứng; clear `published_article_id` và scrub `draft_answer`/`final_answer` của review xuất bản từ chính bài bị xóa để không còn bản sao tri thức. Gỡ điều kiện citation JSONB; citation cũ giữ lịch sử hội thoại ở dạng ID/tên cũ nhưng không tái tạo nội dung đã xóa. Xóa article và write Operational Log trong cùng transaction để không có trường hợp log “đã xóa” nhưng rollback. Catch lỗi database và trả JSON đúng ngữ cảnh.

4. **Đồng bộ hàng đợi và màn hình.** Thêm scope server-side `open` (`new`, `in_review`) cho `/api/unanswered` và dùng nó trong `QueueScreen`; tổng số/pagination dùng cùng điều kiện. Giữ truy vấn status cụ thể chỉ cho màn lịch sử tương lai/deep-link, không để CTA “Xử lý” khả dụng với ticket đã đóng. Sau publish hoặc purge, reload state hiện thời thay vì chỉ đóng form. Chuẩn hóa copy/status label để không rò `published` kỹ thuật.

5. **Cập nhật tài liệu và kiểm chứng.** Cập nhật `docs/API.md`, README/hướng dẫn và `docs/memory/modules/knowledge.md`; thêm ghi chú kế hoạch vào INDEX khi bắt đầu. Chạy migration trên bản sao/DB local, typecheck/build và API smoke: article archive→purge cho bài thường, từng được cited, từ expert review, import, merge-source/merge-result; verify chunks không còn, relation không mồ côi, log có metadata nhưng không content. Test queue tạo→publish→refresh (biến mất), dashboard/queue cùng số open, cùng RBAC và retry delete. Browser acceptance xác nhận modal/xóa/empty/pagination theo desktop/mobile.

## Tiêu chí nghiệm thu

- [ ] Mọi article `archived` mà role có `knowledge:write` xác nhận xóa đều purge được, không bị citation hay bất kỳ FK nội bộ nào chặn.
- [ ] Sau purge không còn `knowledge_articles`, chunks/vectors, tags, audit hoặc content review thuộc article; tất cả FK còn lại hợp lệ và transaction rollback hoàn toàn nếu một bước thất bại.
- [ ] Operational Log ghi đúng một metadata event cho lần purge thành công, không lộ nội dung bài hay chat; retention hiện có áp dụng bình thường.
- [ ] Queue chỉ hiển thị/đếm `new` và `in_review`; ticket đã `published` biến mất sau publish và không có CTA xử lý sai.
- [ ] API/UI/RBAC/docs/migration/test đồng bộ; không còn thông điệp hay rule bảo người dùng chỉ được lưu trữ vì truy vết.

## Rủi ro và quyết định

- Hard-delete là không thể phục hồi. Confirm modal với gõ chính xác tiêu đề giữ vai trò hàng rào cuối cùng; sau xác nhận, server ưu tiên thực thi thay vì giữ dữ liệu vì lineage.
- Citation trong hội thoại có thể hiển thị source không còn truy cập được; đây là hệ quả đã được chấp thuận. UI citation cần fallback “Nguồn đã bị xóa” thay vì link lỗi nếu component đang dereference bài hiện hữu.
- Bản sao `final_answer` lịch sử đang là dữ liệu trùng. Kế hoạch scrub khi purge để tôn trọng xóa; không áp dụng cleanup hàng loạt cho các ticket cũ chưa có hành động purge.
- Migration phải được chạy trên database có dữ liệu thật trước release; `db/init` chỉ áp dụng lúc tạo database mới nên không đủ một mình.

## Kết quả triển khai 29-09-2026

- Đã cập nhật route xóa bài theo transaction: kiểm tra bài archived, gỡ liên kết review/import/gộp, xóa bài cùng chunk/tag/audit, ghi Operational Log metadata và trả thành công khi lặp lại yêu cầu xóa cùng ID.
- Đã chạy `npm run db:migrate` trên database được cấu hình trong `.env.local`; rà `pg_constraint` xác nhận các FK trỏ đến bài viết đều dùng `CASCADE` hoặc `SET NULL`. Migration dọn bản sao câu trả lời ở review đã xuất bản; kiểm tra sau migration còn `0` bản sao.
- Queue và Dashboard gọi `status=open`, tương ứng `new`/`in_review`; database hiện có `0` ticket mở và `1` ticket `published` nên ticket đó không còn thuộc tập dữ liệu hàng đợi. Nhãn trạng thái đã Việt hóa ở các màn active.
- `npm run typecheck` và `npm run build`: PASS. Smoke SQL trong transaction tạo bài/ticket/review giả, gỡ liên kết và xóa bài; kết quả article/chunk/bản sao review đều `0`; transaction đã rollback nên không để lại dữ liệu test.
- API danh sách có phiên kỹ thuật/Admin: `status=open` trả `0`, `status=published` trả `1`, khớp số lượng database; ticket cũ không còn xuất hiện trong hàng đợi.
- NOT-RUN: thao tác xóa bằng browser hoặc gọi DELETE API trên bài thật; không tự xóa 11 bài archived hiện có của người dùng để kiểm thử.
