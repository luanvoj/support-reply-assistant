# Runbook demo dự thi

Runbook này tạo môi trường demo lặp lại cho luồng RAG có căn cứ, chuyển chuyên gia và quản trị tri thức. Nó không cấu hình AI provider, cron production hoặc deploy.

## 1. Bootstrap an toàn

Chỉ dùng trên database demo/local trống hoặc database đã được chấp thuận. `db:seed` cập nhật ba user `*.example.local` và các bài có `source_key` bắt đầu bằng `demo:competition:`; không xóa dữ liệu khác.

1. Tạo `.env` từ `.env.example`, cấu hình `DATABASE_URL`, `AUTH_SECRET` và `SECRETS_ENCRYPTION_KEY` cho môi trường local.
2. Đặt một mật khẩu demo mạnh, riêng cho phiên chạy, trong biến môi trường `SEED_PASSWORD`. Không ghi mật khẩu vào README, ticket, ảnh chụp màn hình hay git.
3. Chạy `npm ci`, `npm run db:up`, `npm run db:migrate`, `npm run db:seed`, rồi `npm run demo:fixture-smoke`.
4. Khởi động ứng dụng bằng `npm run dev`. Sau khi server sẵn sàng, có thể chạy `SMOKE_PASSWORD` bằng cùng mật khẩu demo với `bash scripts/smoke.sh` để kiểm tra health/login/session admin.

`scripts/demo-fixture-smoke.ts` xác nhận ba role, hai bài tri thức đã published/verified, index chunk và retrieval cho câu hỏi có căn cứ. Nó không thay thế kiểm thử UI hoặc provider live.

## 2. Kịch bản trình diễn

| Bước | Vai trò | Thao tác | Điều cần chứng minh |
|---|---|---|---|
| 1 | Sales | Đăng nhập, mở Trợ lý, hỏi: `Điều kiện hoàn tiền dịch vụ là gì?` | Câu trả lời/gợi ý có nguồn từ bài `[DEMO] Điều kiện hoàn tiền dịch vụ`; không bịa mốc xử lý. Khi provider tắt, trình bày Knowledge Suggestions thay vì coi đây là lỗi. |
| 2 | Sales | Hỏi: `Chính sách bảo hành sản phẩm X năm 2035 như thế nào?` | Không có căn cứ thì hệ thống không tự trả lời và tạo yêu cầu chuyên gia. Ghi lại mã/trạng thái ticket hiển thị trên UI. |
| 3 | Technical | Mở hàng đợi chuyên gia, nhận ticket vừa tạo, soạn câu trả lời đã kiểm chứng và xuất bản thành bài tri thức. | Luồng ownership/review/publish; chỉ vai trò phù hợp thấy CTA. |
| 4 | Sales | Hỏi lại đúng câu ở bước 2. | Bài mới là căn cứ; kết quả khác với bước escalation ban đầu. |
| 5 | Technical hoặc Admin | Mở Kho tri thức, tìm hai bài `[DEMO]` về hoàn tiền và chạy Smart Merge theo UI. | Có cặp nội dung gần nhau để trình bày scan, bản nháp/review và bảo toàn nguồn. Không cam kết merge nếu ngưỡng/cấu hình hiện hành không tạo đề xuất. |
| 6 | Admin | Mở nhật ký vận hành sau các thao tác protected. | Thao tác quản trị có dấu vết; không hiển thị mật khẩu hoặc secret. |

## 3. Kiểm tra trước khi trình bày

- `npm run typecheck`
- `npm run retrieval:smoke`
- `npm run demo:fixture-smoke`
- Với server đang chạy: `SMOKE_PASSWORD=<mật-khẩu-demo> bash scripts/smoke.sh`
- Đăng nhập lần lượt ba role để xác nhận các CTA/route nhạy cảm bị giới hạn đúng quyền.

Đánh dấu kết quả PASS/FAIL/BLOCKED. Nếu không có provider hoặc browser session, chỉ trình bày degraded mode và ghi rõ phần provider/live UI chưa được xác minh, không coi là PASS.

## 4. Reset sau demo

Không có lệnh reset phá hủy dữ liệu trong repo. Để chạy lại an toàn, dùng database demo riêng rồi chạy lại `db:migrate` và `db:seed`; các fixture mang source key demo sẽ được cập nhật idempotent. Nếu cần xóa database demo, người sở hữu hạ tầng phải xác nhận chính xác database đích trước khi thực hiện.
