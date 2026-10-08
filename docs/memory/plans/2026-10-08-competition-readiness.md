# Kế hoạch tăng mức sẵn sàng dự thi

## Mục tiêu

Khắc phục bốn nhóm rủi ro được suy luận từ kết quả chấm: workflow tự động, trải nghiệm mobile, tính nhất quán lỗi API/RBAC và khả năng demo lặp lại. Không triển khai production, không cấu hình provider/credential thật, không tạo cron task trên nền tảng deploy trong phạm vi kế hoạch này.

## Trạng thái thực thi — 2026-10-08

- Đã triển khai DB-backed claim/lease/attempt cho đợt Smart Merge, runner CLI `npm run merge:worker`, UI tạo batch + polling và contract deploy; scheduler production chưa được cấu hình.
- Đã chuẩn hóa response guard thành `401 UNAUTHORIZED` và `403 FORBIDDEN` trên các route dùng guard.
- Đã bổ sung mobile layout cho navigation, bảng, chat, modal, CTA, toast và controls vận hành; Playwright PASS tại desktop và 375px cho Dashboard/Trợ lý.
- Đã thêm fixture demo idempotent, smoke retrieval/fixture và runbook; fixture smoke chưa chạy PASS vì database hiện tại không được seed có chủ đích.

## Hiện trạng có căn cứ

- Luồng RAG tự escalation đã tự động, nhưng Smart Merge quét và tạo bản nháp đang chạy tuần tự từ trình duyệt trong `knowledge-screen.tsx`; các tác vụ retention là script CLI phải được platform scheduler gọi.
- Responsive CSS đã có, nhưng AppShell và các luồng authenticated chưa có bằng chứng browser tại các viewport mobile sau các refactor gần đây.
- `requireRole`/`requirePermission` ném `FORBIDDEN`; chỉ một số route tự chuyển lỗi này thành `403`. `GET /api/retrieval/settings` là finding `QC-001` đang mở.
- Repo có migration, seed và smoke scripts nhưng chưa có một bootstrap/demo profile thống nhất, dữ liệu demo có chủ đích và kịch bản chứng minh đầy đủ luồng business an toàn khi provider không được cấu hình.

## Kết quả mong đợi

1. Smart Merge và các tác vụ nền có lifecycle bền vững: queue, lease/idempotency, tiến độ, lỗi/retry và audit; UI không còn là nơi sở hữu việc chạy xử lý dài.
2. Các route chính dùng được ở 375px, 768px và desktop; bảng/hành động có cách thao tác mobile rõ ràng, không chỉ thu nhỏ giao diện.
3. Các API được bảo vệ trả mã lỗi nhất quán (`401`/`403`) và message an toàn, không còn biến lỗi phân quyền thành `500`.
4. Một người chấm có thể khởi tạo và trình diễn luồng có căn cứ, escalation, chuyên gia xuất bản tri thức, và fallback khi chưa cấu hình AI mà không phụ thuộc dữ liệu ngẫu nhiên.

## Phạm vi thay đổi dự kiến

| Workstream | Ownership (module/file) | Dependency | Validation | Chế độ |
|---|---|---|---|---|
| Workflow bền vững | `db/init/002_schema.sql`, `scripts/migrate.ts`, `lib/knowledge/merge-batch.ts`, route job/merge, `components/screens/knowledge-screen.tsx`, operational logs | Quyết định runner | lifecycle, retry/idempotency, RBAC, audit | Tuần tự trước UI tích hợp |
| Mobile | `components/screens/*`, `components/app-shell.tsx`, `app/*.css` | Snapshot UI sau workflow | Browser 375/768/desktop theo role | Có thể triển khai song song sau contract UI ổn định |
| API/RBAC | `lib/auth/guard.ts`, `app/api/**/route.ts`, test/smoke scripts | Contract lỗi chung | matrix unauthenticated/forbidden/valid | Song song, tích hợp cuối |
| Demo readiness | `scripts/seed*.ts`, fixture/import scripts, `README.md`, `docs/QA-PLAN.md` hoặc demo runbook | Luồng workflow và fallback chốt | bootstrap sạch + demo E2E | Sau các contract trên |

## Các bước thực hiện

1. **Chốt contract automation trước khi code.** Tách Smart Merge khỏi request trình duyệt thành job persisted trong PostgreSQL, có trạng thái, attempt, lock/lease, checkpoint từng nhóm, retry hữu hạn, cancel và event log. Giữ nút UI chỉ tạo/theo dõi/hủy job; endpoint runner phải được xác thực riêng và idempotent. Cập nhật migration, server validation, RBAC (`knowledge:write` để tạo/hủy; không mở runner cho user thường), CTA/trạng thái và operational log.

2. **Tạo runner và kiểm chứng không cần provider.** Bổ sung lệnh worker/runner chạy một job hoặc một vòng queue để dùng được tại local/demo; khi Agent tắt, job kết thúc bằng trạng thái giải thích được thay vì treo. Không tự cài cron production. Cập nhật `DEPLOYMENT.md` chỉ với contract để sau này gắn scheduler của nền tảng đã chọn.

3. **Chuẩn hóa lỗi auth và validation của API.** Tạo một helper chuyển lỗi auth sang response có mã phân biệt `401` (không có session) và `403` (có session nhưng không có quyền), rồi áp dụng cho toàn bộ route có guard theo từng family. Không làm lộ chi tiết nội bộ. Rà UI call-site để CTA bị ẩn/disabled theo quyền vẫn khớp validation server, và ghi audit nếu thao tác protected thành công.

4. **Rà và sửa mobile theo luồng dự thi.** Kiểm thử authenticated tại 375px, 768px và desktop cho Dashboard, Trợ lý, Hội thoại/căn cứ, Kho tri thức/Smart Merge, Expert Queue, Settings và Profile. Sửa ưu tiên: sidebar/navigation và target cảm ứng; toolbar/filter; form/modal; bảng chuyển card/summary hoặc có cuộn ngang với CTA không bị che; hai cột sang một cột; trạng thái loading/empty/error. Không đánh đổi desktop hoặc RBAC để đạt layout mobile.

5. **Đóng gói demo lặp lại và bằng chứng.** Tạo profile seed/fixture có dữ liệu tri thức riêng, một cặp bài cho merge, một câu grounded, một câu escalation và account role demo không hardcode password. Thêm smoke scripts cho workflow job, status/error, RBAC response matrix và degraded mode. Viết runbook ngắn theo kịch bản: bootstrap → đăng nhập → hỏi có căn cứ → hỏi thiếu căn cứ → chuyên gia xuất bản → hỏi lại → quan sát workflow/audit; cập nhật README/API/QA plan đúng contract thực tế.

6. **Nghiệm thu liên kết và làm bằng chứng.** Chạy migration trên database sạch, typecheck/build và smoke scripts; chạy browser matrix có ảnh/video cho mobile và role. Rà toàn bộ liên kết của từng tính năng: persistence/migration, API/server validation, RBAC, UI/CTA/state, log/chỉ số, docs và tests. Ghi PASS/FAIL/BLOCKED riêng; phần cron/provider production vẫn để BLOCKED chờ quyết định hạ tầng.

**Kết quả hiện có:** `db:migrate`, `demo:fixture-smoke`, `retrieval:smoke`, `typecheck`, `build` và 5/5 Playwright TC competition readiness PASS. Provider live và scheduler production là **BLOCKED** theo phạm vi; visual review bằng mắt không bị suy ra chỉ từ browser assertions.

## Quyết định còn mở

- **Runner automation:** khuyến nghị giữ DB-backed job + CLI/HTTP runner xác thực để có thể chạy local và dùng trên mọi nền tảng; cần chốt ở lượt sau nền tảng nào gọi runner định kỳ (Vibe Host, container worker, hoặc scheduler khác). Chưa có quyết định này thì không được tuyên bố tác vụ nền chạy tự động ở production.
- **Mức demo AI:** khuyến nghị demo mặc định dùng retrieval/degraded mode không cần key ngoài; nếu ban giám khảo yêu cầu câu trả lời sinh bởi LLM, cần cung cấp provider sandbox và policy chi phí riêng.
- **Kiểm thử visual:** cần một browser có session và dữ liệu demo; nếu không có, source/build chỉ là bằng chứng một phần, không phải PASS mobile.

## Rủi ro thực tế

- Chạy LLM hoặc merge dài trong Next.js request có nguy cơ timeout; vì vậy không giữ xử lý dài ở client/request người dùng.
- Worker song song có thể sinh bản nháp trùng hoặc ghi đè trạng thái nếu không có lease/idempotency; migration và transaction là phần bắt buộc.
- Chuyển bảng sang mobile card có thể làm mất information density; giữ summary quan trọng và đường xem chi tiết thay vì ẩn dữ liệu nghiệp vụ.
- Việc chuẩn hóa lỗi trên nhiều route có thể làm đổi status code mà client đang giả định; cần regression matrix trước khi rollout.

## Không thuộc phạm vi hiện tại

- Cấu hình API key/provider thật, secret, cron/scheduler trên production, domain/TLS, deploy và release authorization.
- Thay đổi thuật toán ranking/embedding hoặc chốt provider/model production.
