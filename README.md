# Support Reply Assistant

Internal SaaS for grounded customer-support replies, knowledge review, and AI-assisted knowledge growth.

## Current status

Local implementation is ready for operational testing:

- Next.js + TypeScript project shell
- PostgreSQL-compatible database configured through environment variables (including Supabase)
- Initial database schema and role seed
- Gemini and Azure OpenAI provider configuration; only one provider is active at a time
- Grounded chat, conversation history with stable message ordering and 90-day retention, and expert-request queue
- Knowledge-base CRUD, text-only bulk import (CSV/XLSX), archive/restore and controlled article merge
- Retrieval settings, assistant persona, source citations and merge-review controls for administrators
- Backend provider adapters, permissions, retrieval, knowledge loop and dashboard APIs
- User administration with role-based access, safe disable/ownership transfer, and controlled data purge
- Self-service password change with password-policy feedback and optional TOTP two-factor authentication
- Stitch-derived responsive UI routes
- Local E2E smoke and security/deployment readiness documents

## UI design gate

Screen direction and visual design must come from Google Stitch MCP plus the related Stitch skills before implementing production UI. Keep Stitch credentials in local tooling configuration only; never commit them to this repository.

## Health check

Use the application manager script to start all local components and print the browser URL:

```bash
./scripts/app.sh start      # default command when omitted
./scripts/app.sh status
./scripts/app.sh restart
./scripts/app.sh stop
./scripts/app.sh logs
```

`start` applies database migrations, starts the Next.js development server, waits for `GET /api/health`, and prints the local URL. The script requires an existing environment file with the database and application secrets configured.

## Knowledge base and AI configuration

- Only text is indexed for retrieval. Create/edit articles in **Kho kiến thức**, or import up to 200 text-only rows from CSV/XLSX using the Excel template in the UI.
- Archived articles are retained for review and can be restored as drafts. Permanently deleting an article is restricted when it has been cited by a conversation.
- **Gộp bài viết** first creates a review batch and drafts; source articles are archived only after an administrator approves the merged draft.
- Administrators configure Gemini or Azure OpenAI in **Cài đặt**. Secrets are encrypted server-side and never returned by the API.
- The assistant keeps conversation history for 90 days by default. A user with access may permanently delete an individual conversation earlier through the application UI.
- When an answer needs expert confirmation, the system either creates an expert request automatically or lets the user request expert support for a partial answer. Each request is linked to its assistant response, so it cannot be created twice from the same response.

## User administration and account security

- Administrators can create, edit, filter and paginate user accounts. Before disabling an account, they must assign its knowledge articles to another active user and assign open expert requests to an eligible active user.
- A disabled account is retained for 30 days before it can be purged by the user-retention task. Purging anonymizes the account and removes its avatar and TOTP factor; it is skipped while the account still has open expert requests.
- Users can view their own profile and change their own password from **Thông tin người dùng**. Passwords must have at least 8 characters, uppercase and lowercase letters, and a special character; only medium or strong passwords are accepted.
- TOTP two-factor authentication is optional in the current rollout. Enabling it requires a verified six-digit authenticator code; disabling it requires the current password.

See [API contract](docs/API.md), [deployment readiness](docs/DEPLOYMENT.md), and the [security report](docs/SECURITY-REPORT-2026-09-22.md).

## Tạo hoặc đặt lại tài khoản quản trị

```bash
ADMIN_PASSWORD='MatKhau-Manh-CuaBan' ./scripts/seed-admin.sh
```

Lệnh chạy migration rồi tạo tài khoản quản trị nếu chưa có, hoặc đặt lại mật khẩu của tài khoản cùng email nếu đã có. Biến `ADMIN_PASSWORD` là bắt buộc và không được in ra terminal. Email mặc định là `admin@example.local`; có thể chỉ định toàn bộ thông tin:

```bash
ADMIN_EMAIL=quantri@congty.vn ADMIN_NAME="Quản trị viên" ADMIN_USERNAME=quantri ADMIN_PASSWORD='MatKhau-Manh-CuaBan' ./scripts/seed-admin.sh
```

## Local setup

```bash
cp .env.example .env.local
npm install
./scripts/app.sh start
```

Run `npm run db:migrate` after configuring a new database connection. For cleanup of disabled accounts that have passed their retention period, review first with `npm run users:retention`; run the same script with `-- --apply` only after confirming the result.
