# Kế hoạch: Chuẩn hóa resilience cho mọi luồng phụ thuộc Agent

## Mục tiêu

Đưa mọi thao tác cần Agent về cùng contract availability/retry/circuit breaker như chat; khi Agent tắt hoặc lỗi, mỗi chức năng hoặc fallback an toàn hoặc dừng với trạng thái nghiệp vụ rõ ràng, không tạo dữ liệu dở dang.

## Hiện trạng đã xác minh

- Chat/RAG đã có degraded mode từ Kho kiến thức và circuit breaker persistent.
- Re-rank trong chat vẫn có thể gọi Agent và chờ tối đa 8 giây trước khi lexical fallback, kể cả circuit đang open.
- Gộp batch (`merge-batch`) và tạo nháp gộp (`knowledge/merge/suggest`) kiểm tra Agent tắt, nhưng gọi provider trực tiếp: chưa dùng timeout/retry/circuit breaker chung.
- Search, CRUD/import/review tri thức, queue và dashboard không gọi Agent; không cần thay behavior khi bật/tắt.

## Quyết định

1. Tách `optional AI enhancement` (re-rank) khỏi `AI-required authoring` (tạo nháp/scan gộp).
2. Optional enhancement: circuit open/tắt Agent thì bỏ qua ngay, dùng lexical result, không lỗi UI và ghi `lexical` telemetry.
3. AI-required authoring: circuit open/tắt Agent thì không tạo/không cập nhật draft; trả reason code an toàn (`AGENT_NOT_CONFIGURED`, `AGENT_COOLDOWN`, `AGENT_UNAVAILABLE`) và CTA chỉ là thử lại sau khi cooldown, không tự retry thao tác ghi dữ liệu.
4. Dùng cùng `provider-resilience` cho generation/rerank, nhưng retry chỉ cho request đọc/AI thuần; mọi persistence chỉ chạy sau khi nhận output hợp lệ.

## Thực hiện

1. Mở rộng resilience helper cho optional probe và `rerank`, đọc circuit trước khi network call; ghi event/mode thống nhất.
2. Thay direct provider call ở answer-route re-rank, merge batch và merge suggest; map error code sang response UI an toàn.
3. Bảo toàn atomicity: batch chỉ chuyển `scanning` khi claim hợp lệ; draft chỉ persist sau validate JSON; retry không nhân bản batch/item/draft.
4. Cập nhật UI merge: disabled/notice theo Agent availability, không để nút có vẻ thực thi được khi circuit cooldown.
5. Bổ sung metrics dashboard: degraded chat, skipped rerank, blocked merge; tài liệu API/module và test matrix.

## Impact map

| Bề mặt | Tác động |
| --- | --- |
| Runtime/API | assistant re-rank, merge batch/suggest, provider health API |
| Persistence | dùng health state hiện có; không đổi knowledge/ticket schema |
| Config/RBAC | chỉ Admin đổi Agent; quyền merge không thay đổi |
| UI/CTA | trạng thái Agent, CTA retry/disabled cho merge; chat không bị ảnh hưởng |
| Metrics/docs/tests | event/error code, dashboard labels, unit+integration+role/browser tests |

## Nghiệm thu

- Agent tắt/open circuit: chat trả suggestion nhanh; re-rank không chờ timeout; merge không tạo dữ liệu dở dang.
- Agent phục hồi: half-open thành công thì re-rank/merge chạy lại bình thường.
- 429/503/timeout: không retry write, không nhân đôi batch/draft/ticket.
- 401/403/config sai: Admin nhận trạng thái an toàn, nhân viên không thấy thông tin secret.

## Quyết định UI hiện tại

Khi đã có Agent active, thanh điều khiển chỉ hiển thị tên Agent đang dùng, không cho chọn lại. Dropdown chỉ xuất hiện sau khi Agent đã tắt để chọn một Agent đã lưu trước khi bấm **Bật Agent**.
