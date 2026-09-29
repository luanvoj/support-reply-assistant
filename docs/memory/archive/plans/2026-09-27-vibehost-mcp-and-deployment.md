# Kế hoạch: kết nối Vibe Host MCP và triển khai ứng dụng

## Kết quả mong đợi

1. VS Code kết nối được Vibe Host MCP bằng cấu hình user-level, không đưa token vào repository hoặc workspace.
2. Xác minh bằng MCP account/quyền, project/site, schema deploy và capability database/storage thực tế của Vibe Host.
3. Chuẩn bị một deployment preview/private từ revision đã push, có PostgreSQL + pgvector, persistent storage avatar, migration, health check và rollback rõ ràng.
4. Chỉ chuyển public release sau khi điều kiện security và exposure được phê duyệt.

## Hiện trạng đã xác minh

- Git remote đã có `main` tại commit `6669e65`; các artifact local không được push.
- Ứng dụng là Next.js 15, cần PostgreSQL 16 + pgvector; health check là `GET /api/health`; migration là `npm run db:migrate`.
- Avatar cần persistent `USER_STORAGE_DIR` (mặc định `./storage/users`), không được expose như public static directory.
- Repository hiện không có Dockerfile; `docker-compose.yml` chỉ là database reference cho local. Không được suy đoán Vibe Host sẽ dùng Compose hay tự build Node cho đến khi MCP trả schema/capability.
- Báo cáo security 2026-09-27 có SEC-005 High (`xlsx`), SEC-001/002/003 Medium còn OPEN. Theo policy release hiện có, public deployment chưa đủ điều kiện khi High chưa xử lý hoặc chưa được chấp nhận rủi ro.

## Phạm vi file dự kiến

- Cấu hình VS Code **user-level** qua lệnh `MCP: Open User Configuration`; không tạo `.vscode/mcp.json` hoặc `.mcp.json` chứa credential.
- Có thể thêm Dockerfile/entrypoint/platform manifest **chỉ sau** khi MCP xác minh contract build/deploy của Vibe Host.
- Có thể cập nhật `docs/DEPLOYMENT.md` và `docs/VIBEHOST-SUBMIT.md` khi topology, URL, tài nguyên và revision đã có bằng chứng.

## Các bước thực hiện

### 1. Thu hồi token đã lộ và cấu hình MCP an toàn trong VS Code

- Chủ sở hữu Vibe Host thu hồi/rotate token đã xuất hiện plaintext trong `mcp.txt`, sau đó xóa hoặc giữ tệp đó ngoài repository/ignore; token cũ không được tái sử dụng.
- Trong VS Code, mở `MCP: Open User Configuration`, dùng schema VS Code (top-level `servers`) với remote HTTP server `vibehost` và URL MCP đã cung cấp.
- Dùng input variable `promptString` có `password: true` cho token, ví dụ header `Authorization: Bearer ${input:vibehost-pat}`. Không đưa token vào workspace config, Git, screenshot hay tài liệu.
- Khởi động qua `MCP: List Servers`, xem server output nếu lỗi và chỉ trust đúng host đã xác minh.

### 2. Khám phá Vibe Host bằng thao tác chỉ đọc

- Qua MCP, liệt kê tool/resource được cấp và xác minh danh tính/quyền, project hoặc organization đích.
- Đọc schema cho: tạo project/app, nguồn Git/revision, buildpack hoặc Dockerfile, env secret, database/pgvector, volume persistent, domain/exposure, migration job, health check, log và rollback.
- Ghi kết quả thật vào deployment document. Nếu MCP thiếu capability bắt buộc, dừng ở plan và nêu chính xác capability/công cụ còn thiếu; không giả định endpoint hoặc lệnh.

### 3. Chuẩn hóa artifact deploy theo contract đã xác minh

- Chọn một topology có thể vận hành: app Next.js + database managed/attached có pgvector; chỉ tách worker nếu Vibe Host yêu cầu và có luồng data rõ ràng.
- Cấu hình build/start, port, `APP_URL`, `DATABASE_URL`, `AUTH_SECRET`, `SECRETS_ENCRYPTION_KEY`, `USER_STORAGE_DIR`; tất cả secret tạo riêng tại Vibe Host, không tái dùng giá trị local.
- Tạo admin bootstrap theo flow đã có, không hard-code credential. Gắn persistent volume cho avatar và backup database/storage trước release.
- Nếu Vibe Host yêu cầu Dockerfile, thêm Dockerfile/entrypoint tối thiểu, đảm bảo migration được chạy một lần trước khi web scale. Không đưa local Compose database vào production nếu platform có managed DB phù hợp.

### 4. Deploy preview/private và kiểm chứng

- Deploy từ commit `6669e65` hoặc revision mới đã được checkpoint/push riêng; không deploy working tree dirty nếu Vibe Host lấy source từ Git.
- Thiết lập health `/api/health`, migration job, giới hạn exposure private/internal và URL preview.
- Xác minh revision, job trạng thái, HTTPS/URL, health database, login admin, persistence avatar sau restart và log không lộ secret.
- Chuẩn bị rollback: revision trước, backup database và volume; không rollback database mù quáng khi đã có dữ liệu mới.

### 5. Quyết định public release và vận hành sau deploy

- Trước public: xử lý SEC-005 hoặc có chấp nhận rủi ro bằng văn bản; áp rate limit login/MFA, outbound egress/SSRF controls, TLS, backup, monitoring và domain policy.
- Nếu chỉ cần internal/preview, ghi rõ exposure, owner, hạn dùng và các rủi ro còn mở; không gọi đó là production-ready.
- Cập nhật tài liệu deployment bằng dữ liệu đo được, sau đó checkpoint/commit/push riêng nếu có thay đổi source/docs.

## Kiểm tra hoàn tất

| Hạng mục | Trạng thái hiện tại | Bằng chứng cần có |
| --- | --- | --- |
| MCP server hiển thị và kết nối được trong VS Code | NOT-RUN | `MCP: List Servers` và tool list, không chứa token. |
| Quyền và schema Vibe Host | NOT-RUN | Kết quả tool/resource read-only. |
| Build đúng revision | NOT-RUN | Deployment job + revision. |
| Migration/database pgvector | NOT-RUN | Job log an toàn + health database. |
| Avatar persistent qua restart | NOT-RUN | Upload, restart, đọc lại avatar. |
| Rollback/backup | NOT-RUN | Runbook và bằng chứng backup phù hợp provider. |
| Public release | BLOCKED | SEC-005 High chưa xử lý/chấp nhận rủi ro; exposure chưa được chốt. |

## Rủi ro và quyết định còn mở

1. Chọn exposure: preview/private (khuyến nghị ban đầu) hay public. Public cần quyết định chấp nhận/khắc phục SEC-005 và các control release.
2. Token trong `mcp.txt` cần rotate trước khi cấu hình. Xóa tệp không thay thế việc thu hồi token cũ.
3. Cần xác minh Vibe Host có Postgres + pgvector và volume persistent. Nếu không có, phải chọn managed database/storage được Vibe Host hỗ trợ, không tự biến Compose local thành production.
4. Chưa có quyền thay đổi VS Code user config hay triển khai provider trong kế hoạch này; thực hiện các mutation đó chỉ sau khi user duyệt bước triển khai.

## Nguồn tham chiếu

- VS Code hỗ trợ remote MCP HTTP qua `.vscode/mcp.json` hoặc user config, có `headers` và input variable bảo mật: [MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).
- User-level MCP phù hợp cho token cá nhân; VS Code khuyến nghị không hard-code thông tin nhạy cảm: [Add and manage MCP servers](https://code.visualstudio.com/docs/agent-customization/mcp-servers).
