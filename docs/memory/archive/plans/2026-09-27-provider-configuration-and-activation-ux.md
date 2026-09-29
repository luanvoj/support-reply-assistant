# Tách cấu hình và bật/tắt Agent theo từng nhà cung cấp

## Kết quả mong đợi

Admin có thể lưu cấu hình độc lập cho cả Google Gemini và Azure OpenAI, nhưng hệ thống chỉ cho phép đúng một Agent hoạt động tại một thời điểm — hoặc cả hai đều tắt.

Mỗi card Agent là nơi duy nhất để thao tác trạng thái của chính Agent đó:

- Agent đã cấu hình, đang tắt → CTA **Bật Agent**.
- Agent đang hoạt động → CTA **Tắt Agent**.
- Chưa có cấu hình hợp lệ → không có CTA bật; hiển thị trạng thái `Chưa cấu hình` và hướng dẫn lưu cấu hình trước.

Khi bật Gemini, Azure tự tắt trong cùng một transaction; khi bật Azure, Gemini tự tắt. Tắt một Agent không tự bật Agent còn lại. Vì vậy chỉ có hai trạng thái hợp lệ: một Agent bật, hoặc cả hai tắt.

## Hiện trạng đã xác minh

- `POST /api/providers` hiện vừa lưu credential vừa nhận `isEnabled: true` từ cả hai form. API vô hiệu hóa provider khác trước khi upsert; vì vậy “Lưu cấu hình” đang ngầm đổi Agent hoạt động.
- `PATCH /api/providers` đã là API bật/tắt riêng, nhưng UI hiện đặt selector + CTA chung ở thanh trạng thái đầu trang thay vì ở card tương ứng.
- UI Gemini chỉ mở danh sách model sau khi xác thực. Sau xác thực, nút lưu bị khóa nếu `model` rỗng; ảnh cho thấy key hợp lệ và 44 model khả dụng nhưng chưa chọn model. Đây là trạng thái đúng về validation nhưng feedback chưa đủ rõ.
- `GET /api/providers` trả cả provider đã lưu và trạng thái `is_enabled`; frontend hiện chỉ nhận Gemini là `configured` nếu Gemini đang bật, khiến trạng thái một cấu hình Gemini đã lưu nhưng tắt bị hiển thị không nhất quán.
- Runtime Trợ lý/gộp bài chỉ truy vấn provider `is_enabled = true`; chế độ gợi ý tri thức vẫn hoạt động khi không provider nào bật.
- Không có database constraint đảm bảo tuyệt đối chỉ một record `is_enabled = true` nếu hai request bật Agent chạy đồng thời.

## Quyết định UX/UI

1. **Thanh trạng thái chung chỉ hiển thị thông tin, không có CTA hay selector.** Nó nêu `Google Gemini đang xử lý phản hồi`, `Azure OpenAI đang xử lý phản hồi` hoặc `Không có Agent hoạt động — Kho tri thức ở chế độ gợi ý`.
2. **Mỗi card có một cụm trạng thái nhất quán ở header:** badge `Đang hoạt động`, `Đã cấu hình · Đang tắt` hoặc `Chưa cấu hình`; ngay cạnh là CTA trạng thái duy nhất của card. CTA dùng primary cho Bật và danger cho Tắt, cùng control height/focus state của design system.
3. **Lưu cấu hình không đổi runtime.** Sau khi lưu Gemini/Azure, card chuyển sang `Đã cấu hình · Đang tắt`, trừ khi nó vốn là Agent đang hoạt động; không tự tắt Agent khác.
4. **Phản hồi model Gemini rõ ràng.** Khi API key đã xác thực mà chưa chọn model, hiển thị feedback inline `Chọn một model được phép trước khi lưu` gần select và giữ CTA lưu disabled. Không tự chọn model đầu tiên để tránh kích hoạt một lựa chọn nhà cung cấp không chủ đích.
5. **Khóa đã lưu được giữ kín.** Với provider đã lưu, để trống key nghĩa là giữ encrypted key hiện có khi cập nhật metadata đã xác thực; nhập key mới là thay thế key. Xác thực key mới vẫn bắt buộc trước khi thay model/endpoint phụ thuộc vào key đó.

## Impact map

| Liên kết | Thay đổi / bằng chứng |
| --- | --- |
| Runtime/API | Tách upsert cấu hình khỏi activation. PATCH activation là lệnh duy nhất đổi `is_enabled`; runtime hiện đã đọc duy nhất provider enabled. |
| Persistence | Migration thêm unique partial index bảo đảm tối đa một provider bật. Migration dọn trường hợp legacy có nhiều provider bật theo thứ tự `is_default`, `updated_at`, rồi tạo index. |
| Cấu hình | Gemini/Azure có thể cùng lưu metadata/credential; không thay đổi retrieval, profile Agent hay circuit-breaker. |
| RBAC | GET/POST/PATCH provider tiếp tục yêu cầu Admin ở server. Chỉ provider đã có cấu hình hợp lệ mới được bật. |
| UI/CTA | Bỏ selector/CTA bật-tắt khỏi runtime panel; thêm CTA theo card, badge đúng trạng thái và feedback model inline. Không giữ CTA mô tả hành vi tự đổi Agent khi lưu. |
| Chỉ số/audit | Dashboard `enabled_providers` phải luôn là 0 hoặc 1; có thể bổ sung audit activation nếu cấu trúc audit provider đã hỗ trợ, không log key. |
| Tài liệu | README, Hướng dẫn sử dụng, API và memory mô tả rõ “lưu cấu hình” khác “bật Agent”. |
| Kiểm thử | API concurrency/unique constraint, các chuyển trạng thái 0↔1, persistence credential, RBAC, chat/merge/degraded mode và UI desktop/mobile. |

## Kế hoạch triển khai

1. **Cứng hóa invariant dữ liệu.** Viết migration idempotent khóa/dọn dữ liệu legacy và tạo unique partial index trên provider đang bật. Cập nhật API activation để transaction khóa tập provider, từ chối provider không cấu hình hợp lệ và chỉ bật một target hoặc tắt target đó.
2. **Tách contract cấu hình khỏi runtime.** Đổi `POST /api/providers` thành upsert cấu hình: provider mới tạo `is_enabled=false`; provider cũ giữ nguyên trạng thái bật/tắt; chỉ thay encrypted key khi client gửi key mới hợp lệ. Không vô hiệu hóa provider khác trong endpoint lưu cấu hình.
3. **Dựng lại card theo trạng thái.** `GET` trả metadata cần thiết để phân biệt đã cấu hình/đang bật. Mỗi Gemini/Azure card hiển thị badge, CTA Bật/Tắt đúng provider, loading/error riêng và refresh trạng thái từ server sau save/toggle. Thanh runtime đầu trang trở thành summary read-only.
4. **Làm rõ validation và bí mật.** Thêm feedback chọn model Gemini; reset verification đúng lúc key/endpoint/deployment đổi; giữ placeholder khóa đã lưu, không hydrate hay phản hồi secret về browser. Cập nhật copy nói rõ bật Agent này sẽ tắt Agent kia.
5. **Rà regression liên kết.** Kiểm tra Trợ lý dùng provider vừa bật, gộp bài chỉ chạy khi có một Agent available, cả hai tắt chuyển đúng sang knowledge suggestions, circuit breaker không bị reset bởi việc chỉ lưu config, dashboard không báo sai số provider, API/RBAC/docs/tests đồng bộ.

## Tiêu chí nghiệm thu

- [ ] Gemini và Azure đều có thể được lưu độc lập mà không thay đổi Agent đang chạy.
- [ ] Một card đang bật được bật card còn lại sẽ atomically chuyển trạng thái thành target bật/nguồn tắt; không có thời điểm hoặc kết quả persistent có hai Agent bật.
- [ ] Có thể tắt Agent đang chạy để cả hai tắt; không CTA nào tự bật provider khác.
- [ ] Không thể bật provider chưa cấu hình hoặc thiếu model/deployment hợp lệ; model Gemini chưa chọn hiển thị lý do rõ ràng.
- [ ] Credential hiện có không bao giờ trả về browser/log; cập nhật metadata không bắt người dùng nhập lại key nếu không thay key.
- [ ] Chat, gộp bài, dashboard và degraded knowledge mode phản ánh đúng 0 hoặc 1 Agent hoạt động.
- [ ] Browser nghiệm thu được các trạng thái Gemini bật, Azure bật, cả hai tắt, đổi Agent, mobile; nếu chưa có browser session, trạng thái phải ghi NOT-RUN.

## Cập nhật triển khai 2026-09-27

- PASS — `POST /api/providers` chỉ lưu cấu hình, không còn tự thay Agent đang chạy; key trống của provider đã lưu giữ nguyên secret mã hóa.
- PASS — `PATCH /api/providers` là lệnh duy nhất đổi trạng thái Agent; transaction và unique partial index đảm bảo tối đa một Agent bật, hoặc cả hai tắt.
- PASS — Card Gemini/Azure có badge + CTA Bật/Tắt riêng; runtime panel chỉ còn thông tin trạng thái. Gemini có feedback inline khi đã xác thực nhưng chưa chọn model.
- PASS — `npm run typecheck`, `npm run db:migrate`, `npm run build` và `git diff --check` đã chạy thành công. Build có cảnh báo Edge Runtime hiện có từ `jose`/`CompressionStream`.
- NOT-RUN — Nghiệm thu browser cho bốn trạng thái (Gemini bật, Azure bật, cả hai tắt, chuyển Agent) và viewport mobile chưa có browser session trong phiên này.

## Rủi ro và việc cần giữ nguyên

- Không tự chọn model Gemini đầu tiên: lựa chọn model là quyết định cấu hình có thể tác động chi phí/chất lượng.
- Không dùng frontend state làm cơ chế độc quyền; unique index và transaction ở server là nguồn sự thật khi nhiều Admin thao tác đồng thời.
- Không thêm fallback provider tự động trong phạm vi này. Khi Agent đang bật mất kết nối, resilience/degraded-mode hiện hành tiếp tục quyết định hành vi an toàn.
