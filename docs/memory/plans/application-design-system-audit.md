# Plan: Audit và chuẩn hóa design system toàn ứng dụng

## Mục tiêu

Áp dụng các tiêu chuẩn từ case study Kho kiến thức cho tất cả surface hiện có: Tổng quan, Trợ lý, Hội thoại, Kho kiến thức, Hàng đợi, Rà soát kỹ thuật, Cài đặt và Đăng nhập. Kết quả là cùng một hệ component/CTA/form/pill/layout responsive, không thay đổi API, role hay quy tắc nghiệp vụ.

## Phạm vi đã xác minh

- UI chính nằm tại `components/dashboard.tsx`, `components/operations.tsx`, `app/login/page.tsx`, dùng chung `app/globals.css`.
- `operations.tsx` có 6 screen vận hành (Trợ lý, Hội thoại, Kho kiến thức, Hàng đợi, Rà soát, Cài đặt); Dashboard và Login là hai flow riêng.
- CSS có nhiều rule lịch sử cho cùng button/panel/article row/typography. Rủi ro là cascade phụ thuộc thứ tự, dẫn tới mỗi màn khác nhau dù dùng cùng class.

## Hệ thiết kế đích

| Primitive | Quy ước |
|---|---|
| Surface | `surface`, `subtle`, `border`, radius và shadow semantic; panel/card/list row không tự đặt biến thể tùy ý. |
| CTA | Primary = tiếp tục/tạo/lưu kết quả chính của ngữ cảnh; secondary = mở công cụ/phụ trợ; link = drill-down; danger = phá hủy. Tối đa một primary cho mỗi vùng thao tác. |
| Form | Control cao nhất quán, label/hint/error theo thứ tự cố định, focus visible rõ. |
| State | Pill co theo nội dung, màu gắn nghĩa (success/warning/info), không dùng để thay CTA. |
| Responsive | Giữ title + hành động; metadata/pill hạ ưu tiên trước; không dùng cột fixed gây chồng lấp. |
| Overlay | Modal/toast/confirm dùng layer, focus, Esc/backdrop và action row nhất quán. |

## Các bước thực hiện

1. **Lập baseline và case study.** Lưu case study Kho kiến thức; inventory từng screen/CTA/list/form/modal qua source. Ghi finding theo impact, không suy đoán visual chưa có screenshot.
2. **Gom token và primitive CSS.** Thiết lập lớp design-system cuối file cho màu, spacing, typography, border, elevation, CTA, pill, focus/disabled. Loại bỏ/thu hẹp các override mâu thuẫn chỉ khi đã có rule thay thế tương đương.
3. **Chuẩn hóa từng flow.** Theo thứ tự Dashboard/Login → Trợ lý/Hội thoại → Hàng đợi/Rà soát → Cài đặt → Kho kiến thức regression. Chỉ đổi layout/semantic classes; giữ nguyên endpoint, payload, permission và status handling.
4. **Responsive và thao tác.** Rà header actions, table/list rows, tabs, modal, editor và action groups ở desktop/tablet/mobile; đảm bảo không chồng lấp, có focus và primary hierarchy đúng.
5. **Xác minh.** Typecheck/build; smoke tất cả route UI; kiểm tra thủ công có screenshot ở 1440px, 1024px, 768px, 375px cho từng flow có thay đổi. Ghi PASS/NOT-RUN rõ ràng.

## Finding đầu vào từ audit source

1. **P0 consistency:** `.ops-button.primary` và `.button.primary` đã từng bị định nghĩa nhiều lần trong `app/globals.css`; cần để một rule cuối mang token chung, không thêm gradient/box-shadow riêng ở screen.
2. **P1 responsive:** Dashboard và operational screens dùng hai nhóm shell khác nhau (`.app-shell`/`.ops-shell`); cần map chúng về cùng token thay vì ép markup giống nhau.
3. **P1 hierarchy:** CTA header/panel/form phải được rà theo quy tắc một primary một vùng; không tự đổi action destructive thành primary.
4. **P1 lists:** Hàng bài viết đã có strategy ưu tiên; bảng queue, history và source rows cần kiểm tra tương tự trước khi thêm fixed columns.
5. **P2 overlay/accessibility:** Modal import đã có Esc/backdrop; confirm modal dùng chung cần rà keyboard/focus; toast cần giữ dismiss/focus không cản workflow.

## File dự kiến

- `app/globals.css`
- `components/dashboard.tsx`
- `components/operations.tsx`
- `app/login/page.tsx`
- `docs/UX-UI-CASE-STUDY-KNOWLEDGE.md`

## Rủi ro/giới hạn

- Đây là audit UI, không thay cho test nghiệp vụ end-to-end. API/function chỉ được smoke ở mức route và interaction có thể kiểm chứng.
- Không có browser automation/screenshot tool trong phiên hiện tại; các kết luận visual chỉ từ source là **NOT-RUN** cho đến khi có kiểm tra thủ công.
- Không gom những khác biệt có chủ đích (danger, warning, trạng thái nghiệp vụ) thành một style duy nhất.

## Kết quả triển khai

- PASS — Case study Kho kiến thức đã được lưu tại `docs/UX-UI-CASE-STUDY-KNOWLEDGE.md`.
- PASS — Đã thêm baseline cuối `app/globals.css`: token spacing/control/focus, CTA/link behavior, disabled/focus state, action-group wrapping và table overflow theo design-system chung.
- PASS — CTA primary được giữ theo semantic từng ngữ cảnh; không có đợt đổi màu/nâng cấp CTA hàng loạt không dựa vào flow.
- PASS — Smoke HTTP 200 cho `/`, `/assistant`, `/conversations`, `/knowledge-base`, `/unanswered`, `/review`, `/settings`, `/login`.
- PASS — `npm run typecheck`, `npm run build`, restart local thành công.
- NOT-RUN — Nghiệm thu visual từng flow tại 1440px/1024px/768px/375px và interaction có dữ liệu thật (import, merge, provider settings, review publish) chưa có browser automation/screenshot evidence trong phiên này.

## Trạng thái

**Baseline đã triển khai; chờ nghiệm thu UI thủ công theo viewport và flow.**
