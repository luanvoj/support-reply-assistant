# Login: chuẩn hóa form và minh họa luồng phản hồi

## Mục tiêu

- Ẩn CTA SSO/Okta vì chưa có authentication flow hoặc cấu hình nhà cung cấp.
- Đồng bộ trường Email hoặc tên đăng nhập với component input của design system.
- Thay sơ đồ node tĩnh bằng minh họa luồng phản hồi có căn cứ, animation nhẹ và hỗ trợ reduced motion.

## Checklist

- [x] PASS — Xóa CTA SSO/Okta và handler feedback không có tác dụng; không thay đổi API login.
- [x] PASS — Đặt class chung cho input login/MFA, áp dụng chiều cao, border, radius và focus state theo token.
- [x] PASS — Thêm diagram: tri thức đã xác minh → truy xuất có căn cứ → phản hồi sẵn sàng; không dùng asset ngoài hoặc animation nặng.
- [x] PASS — Thêm `prefers-reduced-motion`, responsive CSS; `npm run typecheck` và lần build thứ hai `npm run build` PASS.
- [x] PASS — Cập nhật memory: SSO/Okta chỉ được khôi phục khi có IdP, redirect/callback, account mapping, RBAC và kiểm thử.

## Quyết định hiệu lực

- SSO/Okta không phải tính năng khả dụng hiện tại và không được hiển thị như CTA.
- Animation chỉ nâng trải nghiệm hiểu sản phẩm; không được truyền đạt trạng thái runtime thật hoặc thay thế accessibility text.

## Giới hạn nghiệm thu

- NOT-RUN: browser screenshot và kiểm tra tương tác tại desktop/mobile. Cần xác minh card, focus input, reduced-motion và diagram tại viewport thực trước khi gọi là visual PASS.
