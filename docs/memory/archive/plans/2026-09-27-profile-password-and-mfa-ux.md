# Hồ sơ: đổi mật khẩu realtime và xác thực hai bước

## Kết quả mong đợi

Trang Thông tin người dùng cho phép đổi mật khẩu theo một luồng rõ ràng, có phản hồi ngay khi nhập và chỉ gửi được khi đạt chính sách. Khu vực Xác thực hai bước có công tắc Bật/Tắt thực sự, dùng TOTP qua ứng dụng xác thực và không ngầm thay đổi trạng thái khi người dùng chưa hoàn tất xác minh.

## Hiện trạng đã xác minh

- `ProfileScreen` đang đặt Mật khẩu hiện tại, Mật khẩu mới và Nhập lại mật khẩu trong một grid 2 cột; trường xác nhận bị tách khỏi cặp “mật khẩu mới”.
- UI chỉ hiện chữ Độ mạnh Yếu/Trung bình/Mạnh; chưa có checklist realtime hay phản hồi trùng khớp.
- Server hiện yêu cầu ít nhất 10 ký tự, chữ hoa, chữ thường và chữ số. Yêu cầu mới cần đổi chính sách thành ít nhất 8 ký tự, chữ hoa, chữ thường và ký tự đặc biệt.
- Database đã có bảng `user_mfa_totp` và trường `mfa_enabled_at`, nhưng chưa có endpoint/provisioning TOTP, mã khôi phục hoặc login challenge; công tắc hiện chưa thể thực hiện chức năng.

## Quyết định UX và chính sách đề xuất

1. Tách bố cục thành hai nhóm: **Xác thực hiện tại** chỉ có Mật khẩu hiện tại; **Đặt mật khẩu mới** gồm Mật khẩu mới, checklist, mức độ mạnh và Nhập lại mật khẩu mới. CTA nằm dưới cùng, căn phải, chỉ enabled khi cả hai nhóm hợp lệ.
2. Checklist cập nhật theo từng ký tự nhập: ít nhất 8 ký tự, có chữ IN HOA, có chữ thường, có ký tự đặc biệt. Mỗi dòng chuyển từ neutral sang trạng thái đạt, kèm biểu tượng; không dùng màu đỏ như một lỗi cho đến khi người dùng đã rời ô hoặc cố áp dụng.
3. Xác nhận mật khẩu hiển thị ngay “Trùng khớp” hoặc “Chưa trùng khớp” sau khi bắt đầu nhập. Không gửi request nếu checklist chưa đủ hoặc hai trường khác nhau.
4. Chỉ đánh giá strength sau khi bốn điều kiện bắt buộc đều đạt: **Trung bình** khi đạt đủ; **Mạnh** khi dài từ 12 ký tự và có thêm chữ số hoặc nhiều hơn một ký tự đặc biệt. Backend dùng đúng một hàm policy chung để UI không tự đặt luật khác server.
5. Công tắc 2FA là trạng thái có chủ đích: bật mở modal gồm QR/secret TOTP và ô xác nhận mã 6 số; chỉ set `mfa_enabled_at` sau mã hợp lệ. Tắt yêu cầu mật khẩu hiện tại; Admin tắt hộ người khác phải ghi audit. Chính sách vẫn `optional` cho mọi vai trò ở giai đoạn hiện tại.

## Kế hoạch triển khai

1. **Chuẩn hóa policy mật khẩu.** Cập nhật `lib/auth/users.ts` thành rule 8/hoa/thường/đặc biệt, trả về checklist và strength dùng được ở client/server. Cập nhật `app/api/profile/route.ts` để chỉ chấp nhận policy mới và giữ session revocation khi đổi thành công.
2. **Dựng lại password workspace.** Cập nhật `ProfileScreen` và CSS bằng component/card/grid/token hiện hành: nhóm xác thực hiện tại tách khỏi nhóm mật khẩu mới; checklist, status trùng khớp, strength realtime, trạng thái focus/error và CTA disabled có accessibility label.
3. **Hoàn thiện TOTP backend.** Bổ sung thư viện TOTP/QR phù hợp, mã hóa secret bằng key hiện có, endpoint bắt đầu setup, xác minh/bật, tắt, recovery codes và login challenge. Không log secret, mã OTP hay recovery code; giới hạn thử mã và hết hạn provisioning.
4. **Tích hợp 2FA UI.** Thay badge bằng switch chuẩn design system; modal setup/xác minh và modal tắt có yêu cầu mật khẩu. Công tắc phản ánh trạng thái server, disabled khi request đang chạy và không optimistic-update trước khi server xác nhận.
5. **Kiểm thử và tài liệu.** Test checklist/policy server, mismatch, session invalidation, TOTP setup sai/đúng/expired, disable, login khi 2FA bật và responsive viewport. Cập nhật API, README và memory sau khi triển khai.

## Tiêu chí nghiệm thu

- [ ] Ba trường mật khẩu có grouping và nhãn không mơ hồ ở desktop/mobile.
- [ ] Bốn checklist cập nhật realtime; server từ chối mọi mật khẩu không đạt đủ bốn điều kiện.
- [ ] Strength chỉ hiện sau khi qua checklist; confirmation báo chính xác khi trùng/khác; CTA không thể gửi trạng thái chưa hợp lệ.
- [ ] Bật 2FA không có hiệu lực nếu chưa nhập mã TOTP hợp lệ; tắt 2FA yêu cầu mật khẩu hiện tại và được audit.
- [ ] TOTP secret/recovery code không xuất hiện trong log hoặc database dạng plaintext.
- [ ] Toàn bộ CTA/switch/modal/card dùng token, kích thước control, typography và focus state chung của ứng dụng.

## Rủi ro và việc cần chốt

- Bỏ yêu cầu chữ số để khớp checklist mới làm chính sách khác phiên bản đang chạy. Kế hoạch mặc định hiểu đúng theo bốn điều kiện bạn nêu; chữ số chỉ là yếu tố tăng từ Trung bình lên Mạnh, không bắt buộc.
- TOTP cần dependency mới và key mã hóa at-rest. Không thể biến badge thành switch hoạt động thật chỉ bằng CSS; backend/login challenge là phần bắt buộc.
