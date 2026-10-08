# Quy tắc liên kết chức năng

Khi thay đổi bất kỳ chức năng nào, trước khi kết luận hoàn tất phải rà các liên kết của nó: luồng dữ liệu, API và server validation, persistence/migration, cấu hình điều khiển hành vi, RBAC, UI/CTA/trạng thái, báo cáo/chỉ số, tài liệu và kiểm thử.

Không giữ CTA, nhãn, route hoặc cấu hình mô tả một hành vi không còn tồn tại. Nếu chưa thể kiểm tra đầy đủ các liên kết, ghi rõ phần chưa kiểm tra thay vì coi thay đổi cục bộ là hoàn tất.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
