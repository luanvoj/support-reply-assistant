# API contract

All API routes are same-origin Next.js routes. Except for `GET /api/health` and authentication login, routes require a valid httpOnly session cookie and enforce RBAC on the server.

## Authentication and health

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Application and database health. |
| `POST` | `/api/auth/login` | Create session from email and password. |
| `POST` | `/api/auth/mfa/verify` | Complete a pending login with a six-digit TOTP code when MFA is enabled. |
| `POST` | `/api/auth/logout` | Clear current session. |
| `GET` | `/api/auth/me` | Read current session/user. |
| `POST` | `/api/auth/password-reset/request` | Request a six-digit OTP via email with rate limiting and challenge cookie. |
| `POST` | `/api/auth/password-reset/confirm` | Verify OTP challenge, enforce password policy, set new password and revoke existing sessions. |

`POST /api/auth/login` always applies shared and normalized-identity limits; it applies an IP limit only when a trusted proxy supplies a valid forwarded IP. `POST /api/auth/mfa/verify` always limits the pending challenge and conditionally limits its source IP under the same proxy contract; five invalid codes invalidate the pending challenge. Limited requests return `429` with `Retry-After` and never disclose whether an account exists.

`POST /api/auth/password-reset/request` applies global, client-IP, and identity rate limiting. If the user account is active, it invalidates any previously pending OTP for that user, stores an HMAC-SHA256 hash of the 6-digit OTP, sends an email, and issues a signed `httpOnly` challenge cookie. `POST /api/auth/password-reset/confirm` requires the challenge cookie, validates the OTP in constant time within a database row lock, enforces 5 maximum failed attempts, updates the password hash, increments `session_version` to revoke all active sessions, and consumes the OTP token atomically.

## Current user profile and MFA

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/profile` | Read the current user's immutable profile fields and MFA state. |
| `PATCH` | `/api/profile` | Change the current user's password after validating the current password, policy, and confirmation. |
| `POST` | `/api/profile/mfa` | Set up, verify, or disable the current user's TOTP factor. |
| `GET` | `/api/profile/avatar` | Read the current user's private avatar; returns `404` when none exists. |
| `POST` | `/api/profile/avatar` | Upload the current user's avatar as multipart field `file`. |
| `DELETE` | `/api/profile/avatar` | Remove the current user's avatar. |

`POST /api/profile/mfa` uses an `action` body: `setup` returns an enrollment URI and QR data URL; `verify` requires a six-digit `code`; `disable` requires `currentPassword`. A TOTP factor becomes active only after a successful verification. A verification code cannot be reused.

`POST /api/profile/avatar` accepts JPEG, PNG or WebP only. The raw upload must not exceed 5 MB. The server validates the decoded image, normalizes it to WebP and stores it under the authenticated user's server-owned path; clients never choose a storage key.

## Assistant and conversations

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/assistant/answer` | Save a user question and generate either a grounded response or an automatic expert-request escalation. Returns the active assistant name and escalation state. |
| `GET` | `/api/conversations` | List conversations available to the current user. |
| `GET` / `DELETE` | `/api/conversations/:id` | Read one conversation in its persisted message order, or permanently delete it with permission. |
| `GET` / `PUT` | `/api/assistant/profile` | Read/update the active assistant persona (admin). |

## Knowledge base

| Method | Route | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/knowledge/articles` | List or create articles. Create accepts text-only Markdown. |
| `GET` / `PATCH` / `DELETE` | `/api/knowledge/articles/:id` | Read, update, archive, or permanently delete an article. |
| `POST` | `/api/knowledge/articles/:id/restore` | Restore an archived article as a draft. |
| `POST` | `/api/knowledge/import/preview` | Validate a CSV/XLSX upload before import. |
| `POST` | `/api/knowledge/import` | Apply a validated CSV/XLSX import. |
| `GET` | `/api/knowledge/import/template?format=xlsx` | Download the import template. |
| `POST` | `/api/knowledge/import/:id/rollback` | Roll back an import batch when allowed. |

## Article merge

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/knowledge/merge/batches` | Create a bounded scan batch. |
| `GET` | `/api/knowledge/merge/batches` | List recent merge batches. |
| `GET` | `/api/knowledge/merge/batches/:id` | Read batch progress, candidates and safe errors. |
| `POST` | `/api/knowledge/merge/batches/:id/scan` | Run candidate scan. |
| `POST` | `/api/knowledge/merge/batches/:id/cancel` | Cancel queued/scanning/generating batch. |
| `POST` | `/api/knowledge/merge/batches/:id/retry` | Retry a failed or cancelled batch. |
| `POST` | `/api/knowledge/merge/batches/:id/items/:itemId/attach` | Attach a generated draft to its batch candidate. |
| `POST` | `/api/knowledge/merge/batches/:id/items/:itemId/fail` | Record a safe draft-generation failure for its candidate. |
| `POST` | `/api/knowledge/merge/suggest` | Generate a merge draft for an article using the active Agent. |
| `GET` | `/api/knowledge/merge/:id` | Read draft and source comparison. |
| `POST` | `/api/knowledge/merge/:id/approve` | Publish draft and archive source articles. |
| `POST` | `/api/knowledge/merge/:id/reject` | Reject draft and retain sources. |

`POST /api/knowledge/merge/batches/:id/items/:itemId/attach` requires a valid `mergeRunId` UUID. The server enforces state validation, allowing attachment only when the candidate item status is in `('candidate', 'selected', 'generating', 'failed')` before setting it to `drafted`. If the item has already been attached/processed or no longer matches the batch, it returns `409` Conflict.

## Administration

| Method | Route | Purpose |
|---|---|---|
| `GET` / `PUT` | `/api/retrieval/settings` | Read/update active retrieval and merge settings (admin). |
| `GET` / `POST` | `/api/users` | List filtered, paginated user accounts or create an account (admin). |
| `PATCH` / `DELETE` | `/api/users/:id` | Update an account, or permanently hard-delete it after ownership transfer (admin). |
| `GET` | `/api/users/:id/deletion-candidates` | Return server-validated active successor candidates (admin). |
| `POST` | `/api/users/:id/disable` | Disable login only; keeps all account data and security settings (admin). |
| `POST` | `/api/users/:id/restore` | Reactivate a disabled account without changing its credentials or 2FA (admin). |
| `POST` | `/api/users/:id/password` | Reset an active user's password and revoke their sessions (admin, not self). |
| `DELETE` | `/api/users/:id/mfa` | Disable an active user's 2FA and revoke their sessions (admin, not self). |
| `GET` / `PUT` | `/api/operational-logs/settings` | Read or change operational-log retention (admin). |
| `GET` | `/api/operational-logs` | List paginated operational logs; supports category and inclusive Vietnam-date range filters (admin). |
| `GET` | `/api/operational-logs/export` | Download filtered operational logs as `csv` or `xlsx` (admin). |
| `GET` / `POST` / `PATCH` | `/api/providers` | List safe provider metadata, save provider configuration without changing runtime state, or activate/deactivate one saved Agent (admin). |
| `POST` | `/api/providers/test` | Test saved provider connectivity (admin). |
| `POST` | `/api/providers/gemini/validate` | Validate Gemini credentials and retrieve usable models. |
| `POST` | `/api/providers/azure/validate` | Validate Azure endpoint/key and retrieve available configuration. |
| `GET` | `/api/unanswered` | List expert requests for review, with server-side search and pagination. |
| `DELETE` | `/api/unanswered/:id` | Permanently delete a new expert request that has no review (technical/admin). Requires `{ confirm: true }`. |
| `POST` | `/api/unanswered/:id/review` | Publish or resolve an unanswered-question review. |
| `GET` / `PUT` | `/api/settings/smtp` | Read public SMTP metadata or update encrypted SMTP configuration (admin). |
| `POST` | `/api/settings/smtp/test` | Verify draft SMTP connectivity and credentials with DNS resolution checks (admin). |
| `POST` | `/api/settings/smtp/send-test` | Dispatch a live test email to a recipient address using saved SMTP settings (admin). |
| `GET` | `/api/dashboard/summary` | Read dashboard metrics permitted to current user. |

`GET /api/settings/smtp` returns only non-sensitive configuration (`host`, `port`, `secure`, `username`, `fromEmail`, `fromName`, `configured`). It never exposes the encrypted or plaintext SMTP password. `PUT /api/settings/smtp` accepts an optional password (omitting it retains the existing encrypted secret), strictly disallows private/loopback IP addresses or unresolvable internal domains via pre-flight DNS pinning to mitigate SSRF and DNS rebinding attacks, and writes an operational audit log.

`GET /api/users` accepts `page`, `pageSize` (10–100), `search`, `role` (`sales`, `technical`, `admin`) and `status` (`active`, `disabled`, `purged`). Its response contains `users` and `pagination` with `page`, `pageSize`, and `total`.

`POST /api/users` requires `fullName`, `username`, `email`, `password`, `passwordConfirmation`, and `role`. Usernames are 3–50 characters and limited to letters, digits, `.`, `_`, and `-`. Passwords must be 8–128 characters and contain uppercase and lowercase letters plus a special character; the confirmation must match.

`POST /api/users/:id/password` applies the same password policy and confirmation as account creation. It is an administrator-only recovery action for another active account: the password is hashed server-side, all existing target sessions are revoked, and the audit event records only the actor and action type.

`DELETE /api/users/:id/mfa` is an administrator-only recovery action for another active account with 2FA enabled. It removes the stored TOTP factor, revokes existing target sessions, and records an audit event without returning or storing the TOTP secret in the response.

`POST /api/users/:id/disable` only blocks login and revokes existing sessions; it does not transfer data, delete the avatar, reset the password, or disable 2FA. `POST /api/users/:id/restore` reverses that state for a disabled account.

`DELETE /api/users/:id` requires `successorId`. The server validates the active successor hierarchy (sales → technical → admin; technical → admin; admin → admin), transfers operating ownership of knowledge articles and open expert requests, then anonymizes the deleted account's PII, credential, avatar and 2FA. Historical audit records and private conversations remain attached to the tombstone. The last active administrator cannot be deleted.

`GET /api/unanswered` accepts `page`, `pageSize` (10-100), optional `search` (question or creator, limited to 100 characters), optional `status` (`open`, `new`, `in_review`, `answered`, `published`, `rejected`), and optional `id` (UUID). `status=open` returns only `new` and `in_review` and is used by the expert work queue. Without a status filter, the endpoint still returns all records for existing consumers. Its response contains `questions`, `pagination`, and `selected`; `selected` supports a deep link even when that request is outside the requested page.

`DELETE /api/knowledge/articles/:id?permanent=true` requires `{ "confirm": true }` and an archived article. A confirmed deletion removes the article, chunks and attached article data even if the article was cited or linked from a review, import or merge. It clears the corresponding references and review answer copies, and records metadata only in Operational Log. Repeating the request for an already deleted ID succeeds without writing another log.

`DELETE /api/unanswered/:id` is intentionally narrow: the server locks the request and deletes it only when its status is `new` and it has no review. It returns `409` for processed, missing, or no-longer-eligible requests. When this was the final open request of an `escalated` conversation, that conversation returns to `normal`; messages and any unrelated requests remain unchanged.

`POST /api/providers` saves or updates configuration only. A new provider is saved inactive; updating one preserves its current runtime state. An omitted API key for an existing provider retains the encrypted key already stored on the server.

`PATCH /api/providers` requires `{ providerId, isEnabled }`. Enabling a provider disables every other active provider atomically; disabling the active provider leaves the system in verified-knowledge suggestion mode. The database permits at most one enabled provider. The endpoint resets runtime-health cooldown state for that selected provider.

## Security notes

- Provider API keys are encrypted on the server and are not returned in list responses.
- Passwords are stored as password hashes. Changing a password or disabling an account increments its session version so existing sessions are no longer valid.
- TOTP secrets are encrypted at rest. The API returns a QR enrollment value only during setup and never exposes a saved secret.
- Avatar reads are owner-only and served with private, no-store caching. Uploaded images are content-validated, normalized, and stored outside the web root.
- The API does not accept files or images as knowledge article content; only text is indexed.
- Error responses shown to end users use safe messages/codes. Detailed server context must not include provider secrets.

## Assistant escalation contract

POST /api/assistant/answer returns an escalation object for each completed response:

- `none`: the response does not need expert action.
- `created`: an expert request was created automatically because evidence was insufficient or a cited source requires expert confirmation. The response includes ticketId; clients should open that request rather than create another one.

When evidence is sufficient but no Agent is available, the same endpoint returns `decision: knowledge_suggestions` and verified source suggestions instead of a generated answer. Provider outage alone does not create an expert request.

## Operational log query and retention

`GET /api/operational-logs` accepts `page`, `pageSize` (10–100), optional `category` (`account`, `authentication`, `knowledge`, `configuration`), and optional date-only `from`/`to` (`YYYY-MM-DD`). Dates are normalized to `Asia/Saigon`; `to` includes the selected end date. Invalid dates or a reversed range return `400`.

`GET /api/operational-logs/export` accepts the same filters plus required `format=csv|xlsx`. It exports the complete matching result set (up to 10,000 rows), not just the visible page. Each file contains Vietnam-local `Thời điểm`, `Thời gian`, `Người dùng` (actor email) and `Hành động`; it never includes log details or secrets. Older logs whose actor email was not retained export `Không còn lưu`.

Operational logs never contain chat content, passwords, API keys, OTP values or avatar bytes. Admins set retention from 7 to 3650 days; `npm run operational-logs:retention -- --apply` removes expired log rows.

## Account deletion policy

`DELETE /api/users/:id` requires a server-validated active `successorId`. It transfers operating ownership, writes a redacted log snapshot, and then permanently deletes the account credentials, avatar, 2FA and private conversations. The last active administrator cannot be deleted.
