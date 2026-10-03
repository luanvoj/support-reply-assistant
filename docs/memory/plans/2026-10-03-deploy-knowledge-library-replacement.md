# Thay thế kho tri thức trên deploy bằng dữ liệu mô phỏng đã làm sạch

## Kết quả mong đợi

- Database deploy không còn bài viết, chunk, lịch sử import/audit/gộp và log truy xuất cũ có tham chiếu đến kho tri thức cũ.
- Import thành công 47 bài viết mô phỏng tiếng Việt từ workbook đã được kiểm tra tương thích với importer của ứng dụng.
- Không còn kết quả khớp với các từ khóa thương hiệu bị cấm trong kho và log truy xuất đã chọn để xóa.
- Git chỉ nhận thay đổi an toàn: giao diện mô phỏng đã cập nhật và workbook dữ liệu mô phỏng được chọn làm artefact phiên bản; không có `conn.txt`, credential, output tạm hoặc file môi trường.

## Phạm vi và liên kết cần rà

- Persistence: `knowledge_articles`, `knowledge_chunks`, import batch/row, article audit và toàn bộ metadata merge.
- Reporting: `retrieval_logs` có nguồn/tham chiếu cũ sẽ được xóa; không xóa conversations/messages nếu chưa có phê duyệt riêng.
- Import: dùng cùng `parseImportFile` và `insertImportedArticle` như API import để duy trì slug, chunk, source key, review date và audit.
- UI: `app/login/page.tsx` đang dùng nội dung mô phỏng trích từ kho mới; sau import đối chiếu lại ba bài nguồn còn tồn tại trên deploy.
- Git: kiểm tra diff, `.gitignore`, lịch sử staged và secret scan trước commit/push.

## Các bước thực hiện

1. **Chuẩn bị và kiểm chứng input**
   - Dùng workbook `outputs/knowledge-library-2026-10-03/knowledge-library.xlsx` đã được parser của ứng dụng đọc thành công: 47 dòng hợp lệ, 47 nội dung khác nhau.
   - Kiểm tra lại không có dữ liệu nhận diện, nội dung tổ chức, hoặc từ thương hiệu bị cấm.
   - Chuyển/copy workbook vào vị trí versioned được chốt để commit; không commit thư mục tạm, `conn.txt`, `.env*` hoặc credential.

2. **Preflight deploy có kiểm soát**
   - Kết nối bằng thông tin trong `conn.txt` nhưng không ghi/chia sẻ giá trị credential ở terminal, log hay Git.
   - Xác minh host/database/schema và thống kê số bản ghi ở các bảng knowledge cùng `retrieval_logs` trước khi xóa.
   - Xuất backup logic chỉ cho các bảng sẽ xóa, lưu ngoài repository và xóa theo chính sách sau khi nghiệm thu. Nếu không được phép giữ backup vì yêu cầu tuân thủ, ghi nhận rõ và bỏ bước này.

3. **Thay thế dữ liệu trong một transaction**
   - Xóa theo thứ tự phụ thuộc: merge error/item/batch/pair/source/run, import row/batch, article audit, chunk, article; xóa `retrieval_logs` có nguồn cũ để không còn citation/brand stale.
   - Không xóa tài khoản, cấu hình, cuộc hội thoại hoặc message.
   - Tạo import batch mới và import 47 dòng bằng luồng importer, tạo chunk/audit/source key cho từng bài.
   - Rollback toàn bộ nếu bất kỳ dòng nào không hợp lệ hoặc insert/chunk thất bại.

4. **Nghiệm thu deploy**
   - Đếm chính xác bài viết, chunk, import rows, audit rows và distinct `content_markdown`.
   - Quét toàn bộ bảng knowledge và `retrieval_logs` đã xử lý cho chuỗi thương hiệu bị cấm; kết quả phải là 0.
   - Gọi/kiểm tra retrieval với ba tình huống giao diện: đặt lại mật khẩu, bản ghi A, nhận biết thư lừa đảo; bảo đảm chỉ trích nguồn từ bài mới.
   - Ghi rõ PASS/FAIL và mọi dữ liệu ngoài phạm vi chưa kiểm tra.

5. **Commit và push**
   - Stage chọn lọc `app/login/page.tsx`, workbook versioned và tài liệu cần thiết; loại trừ `conn.txt`, output tạm, `.tmp-artifact-vietnamese/` và thay đổi môi trường không liên quan.
   - Chạy `git diff --check`, secret scan, TypeScript/build theo phạm vi; commit conventional message và push `main` chỉ sau khi kiểm tra trạng thái remote.

## Rủi ro và quyết định còn mở

- `conn.txt` chứa credential plaintext. User đã yêu cầu xóa sau khi hoàn tất; không được đưa file này vào stage hay commit. Credential vẫn cần được luân chuyển sau release.
- User đã chọn không giữ backup logic để ưu tiên xóa sạch dữ liệu cũ.
- Workbook versioned đã được chốt tại `docs/fixtures/knowledge-library.xlsx`.
- Conversations/messages vẫn ngoài phạm vi xóa; nếu còn chứa nội dung cũ thì cần phê duyệt riêng.

## Kết quả thực hiện

- Database deploy đã được thay thế trong một transaction: 47 bài viết, 47 chunk, 47 dòng import, 47 audit; 47 nội dung khác nhau.
- Quét từ cấm trên kho tri thức cho kết quả 0; `retrieval_logs` đã được xóa và còn 0 bản ghi.
- Ba tình huống mô phỏng (đặt lại mật khẩu, bản ghi A, nhận biết thư lừa đảo) đều truy hồi đúng bài tương ứng trên deploy.
