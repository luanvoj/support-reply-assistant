# Kế hoạch: rà hồi quy hành vi toàn bộ Cài đặt

## Mục tiêu

Xác nhận bốn tab Cài đặt — **Cấu hình Agent**, **Tri thức & tìm kiếm**, **Nhà cung cấp AI**, **Quản trị người dùng** — vẫn điều khiển đúng hành vi sau các cập nhật Agent, Yêu cầu chuyên gia, tri thức, RBAC và lifecycle tài khoản. Mọi control hiển thị phải có contract runtime thật; control không còn ý nghĩa phải được sửa hoặc loại bỏ.

## Hiện trạng và finding đã xác minh

- Luồng Agent hiện chỉ tự trả lời hoặc tự tạo yêu cầu chuyên gia; không còn nhánh trả lời một phần cho người dùng.
- `partial_answer_threshold` được giữ ở database lịch sử nhưng đã bỏ khỏi payload validation/UI/runtime; khoảng dưới ngưỡng tự trả lời luôn dẫn đến yêu cầu chuyên gia.
- Policy tri thức legacy `partial` được migration sang `escalate`; prompt provider, import, UI và evaluation đã được chuẩn hóa để không còn diễn giải về trả lời một phần.
- Cài đặt gồm settings versioned/history, provider Gemini/Azure, assistant profile và quản trị người dùng; cần kiểm tra không chỉ UI mà cả API, persistence, permission và consumer runtime.

## Impact map

| Bề mặt | Cần đối chiếu |
| --- | --- |
| Runtime/API | `/api/assistant/answer`, retrieval/settings, providers, profile, users; validation và response contract |
| Persistence | `retrieval_settings`, provider/profile/user tables, lịch sử/rollback, migrations và default/seed |
| Cấu hình | Ngưỡng retrieval, verified/replaced/shadow, policy nguồn, persona, provider activation, user lifecycle/2FA |
| RBAC/UI | Admin-only Cài đặt, Chuyên gia/Người dùng bị chặn; control, CTA, disabled/error/success state và copy |
| Vận hành | dashboard/request reason, retrieval log, audit/history, tài liệu API/README/memory |
| Kiểm thử | unit/route behavior, role matrix, persistence/restore và browser acceptance cho mỗi tab |

## Phạm vi triển khai

1. **Lập inventory control → contract.** Liệt kê từng trường/nút trong bốn tab, API ghi/đọc, bảng/field lưu, nơi runtime dùng và role được quyền sửa. Đánh dấu `active`, `legacy-compatible`, `deferred` hoặc `dead`; không dựa vào label UI để kết luận.

2. **Chuẩn hóa quyết định Agent và Tri thức & tìm kiếm.**
   - Loại control “Trả lời một phần” khỏi UI/settings payload mới; giữ column cũ cho lịch sử tương thích nhưng không để nó điều khiển một hành vi không tồn tại.
   - Phân loại ticket theo mức căn cứ (thấp hơn legacy threshold / chưa đạt ngưỡng tự trả lời) chỉ khi dashboard/workspace có consumer rõ ràng; nếu chưa có consumer, không hiển thị control đó.
   - Đồng bộ policy `partial` trong article/import/provider prompt/UI: đổi sang policy chuyên gia rõ nghĩa hoặc migrate có kiểm soát, để không nói Agent có thể trả lời một phần khi thực tế không làm vậy.
   - Kiểm tra `autoAnswerThreshold`, `sensitiveThreshold`, `sensitiveTopics`, verified-only, exclude-replaced, top-K/weights/diversity và shadow mode có tác động đúng đến retrieval/decision/log.

3. **Rà Cấu hình Agent và Nhà cung cấp AI.** Kiểm chứng mọi field profile xuất hiện trong prompt/response đúng chỗ, không làm suy yếu grounded policy; kiểm tra provider validation, bật/tắt/default/fallback, secret masking và lỗi provider chỉ cho retry kỹ thuật chứ không tạo yêu cầu chuyên gia sai.

4. **Rà Quản trị người dùng và liên kết vận hành.** Kiểm tra tạo/sửa/vô hiệu hóa/làm sạch/chuyển ownership, pagination/filter, avatar, password/2FA và RBAC server-side. Đối chiếu việc chuyển/gỡ người dùng với bài tri thức, yêu cầu chuyên gia, session và audit để các thay đổi queue mới không làm hỏng lifecycle cũ.

5. **Regression và tài liệu.** Thực hiện matrix Admin/Chuyên gia/Người dùng cho route/API; mỗi control active phải có test thay đổi cấu hình → persistence → hành vi quan sát được. Cập nhật API/README/module memory theo contract cuối cùng, ghi rõ `NOT-RUN` nếu browser/provider/database không thể nghiệm thu trong phiên.

## Tiêu chí nghiệm thu

- Không còn control hoặc copy “Trả lời một phần” khi Agent không có nhánh này.
- Thay đổi ngưỡng tự trả lời/chủ đề nhạy cảm làm thay đổi đúng nhánh answered/fallback; policy nguồn và lý do ticket nhất quán.
- Mỗi control hiển thị trong bốn tab hoặc có consumer runtime chứng minh được, hoặc bị bỏ/đánh dấu hoãn với lý do.
- Restore settings khôi phục được cấu hình hợp lệ; validation không còn áp quy tắc của nhánh nghiệp vụ đã bỏ.
- RBAC Cài đặt đúng ở cả navigation, route và API; user lifecycle không mất liên kết tri thức/yêu cầu chuyên gia.
- Typecheck/build đạt; kết quả browser/provider thực tế được phân biệt rõ PASS/FAIL/NOT-RUN.

## Rủi ro và quyết định mở

- Shadow mode và đánh giá semantic cần dữ liệu/provider thật; nếu không có, chỉ xác minh contract/log và ghi NOT-RUN cho chất lượng retrieval.
- Không mở rộng sang tính năng mới ngoài việc làm đúng contract đang hiển thị, trừ khi finding buộc phải sửa để tránh sai dữ liệu hoặc lộ quyền.

## Trạng thái triển khai

- PASS — inventory tĩnh đã đối chiếu UI, route, persistence và runtime của retrieval/profile/provider/user management; finding contract đã xử lý ở luồng Agent và Tri thức.
- PASS — UI/API/evidence/prompt/import/evaluation không còn nhánh trả lời một phần; migration đã chạy để đổi policy bài tri thức cũ `partial` thành `escalate`.
- PASS — `npm run typecheck`, `npm run retrieval:smoke`, `npm run db:migrate` và `npm run build` đều đạt.
- NOT-RUN — browser acceptance từng control, provider gọi thật và matrix RBAC end-to-end chưa có browser session trong phiên; cần nghiệm thu bằng tài khoản Admin/Chuyên gia/Người dùng.
