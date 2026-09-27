# Quy tắc liên kết chức năng

Khi thay đổi bất kỳ chức năng nào, trước khi kết luận hoàn tất phải rà các liên kết của nó: luồng dữ liệu, API và server validation, persistence/migration, cấu hình điều khiển hành vi, RBAC, UI/CTA/trạng thái, báo cáo/chỉ số, tài liệu và kiểm thử.

Không giữ CTA, nhãn, route hoặc cấu hình mô tả một hành vi không còn tồn tại. Nếu chưa thể kiểm tra đầy đủ các liên kết, ghi rõ phần chưa kiểm tra thay vì coi thay đổi cục bộ là hoàn tất.
