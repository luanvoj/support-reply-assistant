# Kế hoạch: Landing page Hướng dẫn sử dụng

## Mục tiêu

Thêm mục **Hướng dẫn sử dụng** ngay dưới **Tổng quan** ở sidebar và xây dựng một landing page hướng dẫn theo ngữ cảnh cho mọi vai trò. Mục tiêu là giúp người mới hiểu cách ứng dụng đưa ra phản hồi có căn cứ, khi nào phải chuyển chuyên gia, ý nghĩa của điểm tin cậy, cách quản trị tri thức/gộp bài và tác động thực tế của từng cấu hình — không yêu cầu họ đọc tài liệu kỹ thuật.

## Hiện trạng đã xác minh

- Sidebar được điều khiển tập trung tại `components/app-shell.tsx`; role `sales` hiện chỉ thấy Tổng quan và Trợ lý, `technical` không thấy Cài đặt, còn `admin` thấy toàn bộ mục.
- Luồng trả lời có các nhánh thật: câu trả lời có căn cứ, đề xuất tri thức khi Agent không sẵn sàng, chuyển yêu cầu chuyên gia khi thiếu căn cứ/policy yêu cầu; social/clarification là nhánh hội thoại riêng.
- Điểm quyết định sử dụng `evidence.score`, đối chiếu với `autoAnswerThreshold` hoặc `sensitiveThreshold`; nguồn policy `escalate` buộc chuyển chuyên gia dù có tài liệu.
- Gộp bài là tác vụ có Agent bắt buộc: chỉ quét bài published theo phạm vi/cấu hình, lọc trước bằng retrieval, Agent re-rank xác nhận, rồi người dùng duyệt bản nháp trước khi xuất bản. Khi Agent tắt/không sẵn sàng, thao tác bị chặn có giải thích.
- Cài đặt hiện gồm: Hồ sơ Agent, Tri thức & tìm kiếm, Nhà cung cấp AI/CTA bật-tắt Agent, và Quản trị người dùng. Một số nội dung chỉ Admin được đổi.

## Thiết kế đích

Route mới: `/guide`, trong AppShell, có sidebar tab/anchor nội bộ và nội dung cuộn một trang. Không cần API, DB hay trạng thái onboarding mới ở phiên bản đầu.

```text
Hướng dẫn sử dụng
├─ Bắt đầu nhanh theo vai trò
├─ Agent xử lý một câu hỏi như thế nào?
│  Nhận câu hỏi → tìm nguồn → đánh giá căn cứ → một trong ba kết quả
│  ├─ Đủ căn cứ: trả lời + nguồn + điểm tin cậy
│  ├─ Agent không sẵn sàng: gợi ý từ nguồn đã xác minh
│  └─ Chưa an toàn: tạo Yêu cầu chuyên gia + nêu lý do thật
├─ Hiểu điểm tin cậy và nguồn tham khảo
├─ Kho tri thức và cách Agent đề xuất gộp bài
├─ Cài đặt tác động thế nào đến kết quả
└─ Câu hỏi thường gặp / đường dẫn hành động theo quyền
```

### Nguyên tắc nội dung

- Dùng sơ đồ CSS/SVG có nhãn và mô tả bằng văn bản thay vì ảnh trang trí; có thể đọc bằng màn hình đọc và không phụ thuộc Agent runtime.
- Tách rõ **điểm tin cậy** (mức độ căn cứ của kết quả truy xuất) khỏi lời “cam kết đúng tuyệt đối”; trình bày theo ví dụ: 80% là ngưỡng cấu hình chứ không phải xác suất sự thật.
- Không hiển thị CTA dẫn đến chức năng người xem không có quyền. Sales có CTA Trợ lý/Hội thoại; Technical thêm Kho tri thức/Yêu cầu chuyên gia; Admin thêm Cài đặt/Quản trị người dùng.
- Với hành vi chưa hoàn tất contract (phân công ticket, phản hồi riêng, SSO), chỉ nói “chưa hỗ trợ” hoặc không đưa vào hướng dẫn; không mô tả như tính năng đang dùng được.

## Đề xuất để trang hướng dẫn chuyên nghiệp hơn

1. **Bản đồ luồng tương tác:** mỗi bước của sơ đồ có thể mở “Vì sao hệ thống làm vậy?” với ví dụ input, nguồn tìm thấy, điểm căn cứ và output nhân viên nhận được.
2. **Hướng dẫn theo vai trò:** một bộ chọn Vai trò của tôi để lọc nội dung; luôn ghi chú đây là hướng dẫn, quyền thật vẫn do tài khoản quyết định.
3. **Checklist bắt đầu nhanh:** checklist chỉ lưu local browser ở phiên bản đầu (không tạo dữ liệu nhân sự): mở Trợ lý, xem nguồn, hiểu escalation, và với quyền phù hợp là kiểm tra cấu hình/tri thức.
4. **Liên kết sâu có ngữ cảnh:** CTA “Mở Cài đặt tri thức”, “Mở Kho tri thức”, “Mở Yêu cầu chuyên gia” đi đúng route/tab/anchor thay vì bắt người dùng tự tìm.
5. **Phiên bản và tính minh bạch:** chân trang ghi rõ “Hướng dẫn phản ánh chức năng đang bật trong ứng dụng”; cấu hình và quyền hiện tại có thể làm một số bước không khả dụng.

## Impact map

| Liên kết | Tác động và cách xử lý |
| --- | --- |
| Runtime/API | Không có API mới ở bản đầu; nội dung tĩnh được đối chiếu code contract hiện tại. |
| Persistence/migration | Không đổi DB. Checklist, nếu có, dùng `localStorage` theo thiết bị và phải có fallback khi storage bị chặn. |
| Cấu hình điều khiển | Trang diễn giải retrieval/provider settings nhưng không tự thay đổi cấu hình. Nội dung phải đồng bộ `RetrievalSettings` và trạng thái Agent. |
| RBAC | Route protected như các màn AppShell; sidebar và CTA lọc theo role, server guard của route đích vẫn là nguồn quyết định cuối cùng. |
| UI/CTA/trạng thái | Thêm nav dưới Tổng quan; link active/label/icon/shortcut responsive cùng design system. Không CTA giả cho tính năng chưa triển khai. |
| Chỉ số/tài liệu | Không thêm analytics khi chưa có privacy/measurement contract. Hướng dẫn là tài liệu in-app, cần ghi nguồn/changelog khi logic thay đổi. |
| Kiểm thử | Route, sidebar từng role, anchor, deep link CTA, reduced motion/accessibility, mobile layout và đối chiếu nội dung với Agent-off/Agent-on/merge behavior. |

## Các bước triển khai

1. Tạo contract nội dung từ runtime thật: chốt các nhánh Agent, cách đánh giá evidence, degraded mode, escalation và merge; rà lại mọi nhãn Cài đặt để diễn giải bằng ngôn ngữ nghiệp vụ.
2. Thêm screen/route `/guide` và nav **Hướng dẫn sử dụng** ngay sau Tổng quan; áp dụng role-aware visibility, active state, guard và các deep link có kiểm quyền.
3. Dựng landing page theo design system: hero + chọn vai trò, sơ đồ Agent có các nhánh, khối điểm tin cậy/nguồn, lifecycle tri thức & gộp bài, bảng Cài đặt → tác động → khi nào nên đổi, FAQ/CTA.
4. Thêm anchor navigation, checklist local tùy chọn, trạng thái focus/keyboard/reduced-motion và layout responsive; bảo đảm sơ đồ vẫn hiểu được khi CSS animation bị tắt.
5. Nghiệm thu contract: Agent on/off, evidence đủ/thiếu/sensitive-policy, merge provider unavailable, quyền sales/technical/admin, link cài đặt và các breakpoint.

## Tiêu chí nghiệm thu

- Người dùng mới có thể giải thích đúng ba kết quả chính của một câu hỏi: phản hồi có căn cứ, gợi ý từ kho khi Agent không sẵn sàng, hoặc chuyển chuyên gia.
- Không có câu nào gọi điểm tin cậy là “độ chính xác tuyệt đối”; nêu được ngưỡng cấu hình, nguồn và policy ảnh hưởng thế nào.
- Hướng dẫn gộp bài mô tả đúng: Agent chỉ đề xuất, người có quyền vẫn duyệt bản nháp; Agent không sẵn sàng thì không quét gộp.
- Mỗi vai trò chỉ thấy CTA phù hợp; thao tác trực tiếp vào route đích vẫn bị server bảo vệ.
- Sidebar giữ đúng thứ tự, desktop/mobile không tràn, bàn phím/reader truy cập được anchor và sơ đồ.

## Quyết định mở

- Chưa nên thêm video, tracking tiến độ tập trung hoặc tour tự động. Các hạng mục này cần quyết định về nội dung, analytics/privacy và trạng thái lưu trữ riêng.
- Nếu cần hướng dẫn có thể cập nhật không cần deploy, vòng sau có thể chuyển nội dung sang CMS/knowledge article; hiện tại nội dung code-managed giúp khớp contract nhanh hơn.

## Trạng thái triển khai

- PASS — thêm route protected `/guide`, nav **Hướng dẫn sử dụng** ngay sau Tổng quan và icon riêng; `sales` được phép vào route nhưng chỉ thấy CTA phù hợp, `technical`/`admin` thấy CTA mở rộng theo quyền.
- PASS — landing page có hướng dẫn theo vai trò, sơ đồ ba nhánh Agent, giải thích điểm căn cứ, lifecycle tri thức/gộp bài, bảng Cài đặt → tác động và anchor navigation.
- PASS — deep link `/settings?tab=retrieval` mở tab Cài đặt tương ứng; server/middleware vẫn là lớp quyết định quyền cuối cùng.
- PASS — `npm run typecheck`, `npm run build`, `git diff --check`.
- NOT-RUN — nghiệm thu browser theo từng role và viewport; cần kiểm tra trực tiếp nav, CTA, anchor, focus keyboard và layout mobile trong phiên đăng nhập.
