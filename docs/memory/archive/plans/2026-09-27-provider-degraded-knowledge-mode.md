# Kế hoạch: Chế độ tra cứu tri thức khi Agent không sẵn sàng

## Mục tiêu

Giữ Trợ lý hữu ích và an toàn khi không có Agent được cấu hình, Agent hết quota, lỗi mạng hoặc dịch vụ AI tạm thời không phản hồi. Hệ thống vẫn tra cứu **Kho kiến thức đã xuất bản/được phép dùng**, nhưng tuyệt đối không biến lỗi kỹ thuật thành yêu cầu chuyên gia hoặc tự sinh câu trả lời không có căn cứ.

## Kết luận thiết kế

Tách hai quyết định vốn đang bị lẫn vào nhau:

1. **Quyết định tri thức**: `grounded` hoặc `needs_expert`, dựa hoàn toàn vào retrieval, ngưỡng cấu hình và policy nguồn.
2. **Cách trình bày**: `generated` khi Agent hoạt động; `knowledge_suggestions` khi Agent không sẵn sàng nhưng căn cứ đủ; `expert_request` khi kiến thức thực sự chưa đủ; `local_guidance` cho xã giao, câu hỏi về Trợ lý và câu quá mơ hồ.

Tình trạng Agent không bao giờ là lý do tạo phiếu. Nó chỉ quyết định cách giao kết quả của cùng một quyết định tri thức.

## Phát hiện từ code hiện tại

- `searchPublishedChunks()` và `hybridRank()` đã chạy được bằng PostgreSQL lexical ranking khi không có provider. Bộ lọc published/verified/hiệu lực/policy vẫn được áp dụng.
- Re-rank LLM đã tự rơi về lexical sau 8 giây; lỗi re-rank riêng lẻ không được chặn generation hoặc kích hoạt degraded mode.
- `POST /api/assistant/answer` chỉ ghi `provider_error` nếu provider đã được gọi rồi thất bại. Nếu **không có provider bật**, câu hỏi đủ căn cứ rơi về `fallback`, từ đó tạo yêu cầu chuyên gia sai nguyên nhân.
- `messages.message_mode` trong schema gốc chỉ cho `grounded/social/review`, trong khi runtime hiện đã ghi `provider_error`; `retrieval_logs.decision` migration cũng chưa cho `provider_error`. Chênh lệch schema–runtime này phải được sửa trước khi thêm mode mới.
- Provider adapter dùng `fetch` không timeout, làm mất status/header có cấu trúc và chưa có retry, backoff hay circuit breaker. Azure trả `retry-after-ms` cho 429; Gemini khuyến nghị retry hữu hạn với exponential backoff + jitter cho 429/503, không retry lỗi cấu hình/client.
- Settings hiện chỉ cho một provider bật, dù route có vòng lặp fallback. Giữ nguyên chính sách một provider; không biến degraded mode thành failover đa-provider ngầm.

## Flow mục tiêu

```text
Câu hỏi
  -> kiểm tra xã giao / meta / mơ hồ
       -> local_guidance (không gọi Agent, không tạo phiếu)
  -> retrieval cục bộ + policy + evidence
       -> needs_expert
            -> tự tạo / gộp Yêu cầu chuyên gia với lý do tri thức thật
       -> grounded
            -> Agent healthy? -> generated answer + citation
            -> Agent unavailable? -> knowledge_suggestions + citation/excerpt nguyên văn
```

### `knowledge_suggestions`

- Dùng tiêu đề, excerpt nguyên văn giới hạn độ dài và citation của nguồn đã vượt ngưỡng; không suy diễn, tóm tắt hay ghép thành cam kết nghiệp vụ mới.
- Copy: “Agent tạm thời chưa sẵn sàng. Dưới đây là các đoạn thông tin đã được xác minh để bạn tham khảo.” Hiển thị điểm căn cứ và số nguồn, kèm CTA **Thử lại Agent**.
- CTA dùng contract idempotency/retry chuyên biệt; không tạo tin nhắn hoặc ticket thứ hai. Khi circuit đang open, UI chỉ hiển thị thời gian có thể thử lại.
- Nếu evidence thấp, không có nguồn hoặc source policy `escalate`: không hiển thị như gợi ý trả lời; tạo/gộp phiếu với lý do tri thức như flow đã chốt.
- Sensitive topic vẫn dùng `sensitiveThreshold`; degraded mode không nới ngưỡng.

## Phạm vi triển khai

### 1. Chuẩn hóa contract và state

- Định nghĩa enum dùng chung cho `knowledge_decision`, `delivery_mode`, `provider_availability`, reason code an toàn cho UI (`not_configured`, `cooldown`, `rate_limited`, `temporarily_unavailable`, `misconfigured`). Không gửi API key, endpoint hay stack trace ra nhân viên.
- Chuyển route trả lời sang quyết định tri thức trước; chỉ tạo ticket khi `needs_expert`.
- Sửa idempotency/read-back để nhận `knowledge_suggestions`; continuity retrieval kế thừa citation từ message có căn cứ (`grounded` và `knowledge_suggestions`) còn hiệu lực.
- Chuẩn hóa `messages.message_mode` và `retrieval_logs.decision` bằng migration có backfill/constraint mới; không xóa lịch sử `provider_error`.

### 2. Resilience cho provider

- Bọc generation (không phải retrieval) trong deadline; phân loại từ HTTP status và `Retry-After`/`retry-after-ms` trước khi biến thành lỗi domain.
- Retry tối đa 1 lần trong request cho `408`, `429`, network timeout và `5xx`; dùng server-provided delay nếu còn request budget, nếu không exponential backoff có jitter. Không retry `400/401/403` hay lỗi endpoint/decrypt/configuration.
- Lưu circuit breaker theo provider trong PostgreSQL: `closed`, `open`, `half_open`, `opened_until`, `consecutive_failures`, `last_failure_code`, `last_success_at`. Dùng lock/atomic update để nhiều instance không đồng loạt probe lại.
- Khi `open`, bỏ qua gọi provider và trả degraded result ngay. Hết cooldown chỉ một half-open probe được chạy; thành công đóng circuit, thất bại mở lại theo backoff giới hạn.
- Admin test provider ghi health an toàn, có CTA “Kiểm tra lại / mở lại kết nối”; không tự bật provider đang tắt và không tiết lộ secret.

### 3. API, persistence, dashboard

- Mở rộng answer response với `deliveryMode`, `providerAvailability`, `retryAfterSeconds`, `sourceCount`; giữ field cũ tương thích cho history/UI cũ.
- Bổ sung bảng health runtime hoặc event append-only tối thiểu; không ghi prompt/response provider vào health log.
- Lưu delivery mode, evidence, source snapshot và provider null ở degraded mode. Retrieval log vẫn ghi retrieval thành công cùng reason code kỹ thuật đã redacted.
- Dashboard tách “Yêu cầu chuyên gia do thiếu kiến thức” khỏi “Lượt gợi ý khi Agent không sẵn sàng”; `unanswered_open` không tăng vì outage.

### 4. UI/RBAC

- Chat hiển thị card “Gợi ý từ Kho kiến thức” khác biệt với câu trả lời AI; citation dùng component hiện có, label không nói Agent đã trả lời.
- Admin thấy trạng thái Agent trong Cài đặt Nhà cung cấp AI; sales/technical chỉ nhận thông điệp ngắn gọn và thời gian thử lại.
- Không thay quyền `chat:use`, workspace chuyên gia hoặc flow dedup đang lên kế hoạch. Khi `needs_expert`, đi qua đúng contract ticket/dedup.

### 5. Không làm trong đợt này

- Không cache câu trả lời LLM: có nguy cơ stale khi nguồn bị thay thế/archive/đổi policy. Chỉ dùng source hiện còn valid.
- Không tự chuyển đổi provider vì settings hiện chốt một Agent active và chưa có contract failover/quota đa-provider.
- Không thêm embedding/vector; lexical retrieval hiện hữu là fallback có căn cứ.

## Bản đồ tác động bắt buộc

| Bề mặt | Thay đổi/kiểm tra |
| --- | --- |
| Runtime/API | answer route, provider adapter, rerank fallback, conversation read-back, provider test API |
| Dữ liệu/migration | mode/decision constraints, health runtime state/event, backfill lịch sử |
| Cấu hình | retrieval/sensitive thresholds giữ nguyên ý nghĩa; provider enable/disable, health/cooldown chỉ Admin |
| RBAC | nhân viên chỉ chat + nhận gợi ý; admin mới xem/reset health; không thêm quyền expert |
| UI/CTA | card suggestion, citation, retry có cooldown; không tạo phiếu do outage |
| Metrics | generated/degraded/expert tách riêng; health failure/recovery, retry, circuit-open; không lộ lỗi bí mật |
| Docs | API, ARCH, module assistant/settings, memory index, playbook vận hành provider |
| Test | unit/e2e/migration/concurrency/error mapping/browser acceptance |

## Thứ tự thực hiện

1. Viết type/contract tests: ma trận decision × provider availability; sửa migration constraint mismatch.
2. Bổ sung lỗi có cấu trúc, timeout và bounded retry cho adapter; mock `429`, `503`, timeout, `401`.
3. Thêm persistent circuit breaker; test concurrent, half-open, restart-safe.
4. Refactor answer route theo knowledge decision + delivery mode; bảo toàn idempotency, continuity, ticket source-message unique và source policy.
5. Dựng UI degraded card/citation/retry, provider health Admin; kiểm tra role/viewport.
6. Cập nhật dashboard/docs, chạy staging migration và nghiệm thu E2E provider giả + provider thật.

## Ma trận nghiệm thu

| Tình huống | Kỳ vọng |
| --- | --- |
| Không cấu hình Agent + căn cứ đủ | Gợi ý nguồn xác minh; không ticket; không gọi provider |
| Không cấu hình Agent + căn cứ thiếu/policy escalate | Một yêu cầu chuyên gia với lý do tri thức thật |
| 429/503/timeout + căn cứ đủ | Retry trong budget; sau đó degraded; circuit hạn chế request tiếp theo |
| 401/403/config sai + căn cứ đủ | Không retry; degraded ngay; Admin thấy health an toàn |
| Provider khôi phục | Half-open probe thành công; câu mới quay về generated |
| Re-rank lỗi, generation tốt | Vẫn generated với lexical sources |
| Social/meta/mơ hồ khi Agent down | Hướng dẫn deterministic; không ticket |
| Sensitive / policy escalate | Không gợi ý như câu trả lời; dùng ngưỡng/chuyên gia như cũ |
| Retry UI / refresh / double submit | Không nhân đôi message, log hay ticket |
| Nhiều instance cùng outage | Không probe storm; circuit state nhất quán |

## Rủi ro và giảm thiểu

- **Excerpt bị hiểu là câu trả lời chính thức:** label/màu khác biệt, nói rõ là trích đoạn nguồn; chỉ hiện khi `grounded`.
- **Retry làm chậm chat:** deadline và retry budget nhỏ; hết budget chuyển degraded ngay.
- **Circuit state ghi quá nhiều:** chỉ ghi transition/state change, aggregate metric; không log nội dung nhạy cảm.
- **Migration hỏng lịch sử:** migration idempotent, backup/smoke trước production.
- **Nhầm lỗi provider với knowledge gap:** reason code kỹ thuật tách hoàn toàn khỏi ticket creation và backlog dashboard.

## Quyết định còn mở

- Cooldown đề xuất: 60 giây transient, 5 phút quota `429`, 15 phút auth/config; cần chốt theo SLA/quota thật trước production.
- Đề xuất hiển thị “Thử lại Agent” cho nhân viên nhưng disable trong cooldown.
- Đề xuất giữ health history 30 ngày, chỉ code/đếm/thời điểm.

## Nguồn thiết kế

- [Circuit Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- [Retry pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry) và [Transient fault handling](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults)
- [Gemini troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting)
- [Azure OpenAI quota and rate limits](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/quota)
