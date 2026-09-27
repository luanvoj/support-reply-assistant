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
| `POST` | `/api/assistant/answer` | Save a user question and generate a grounded, partial, or escalation response. Returns the active assistant name and escalation state. |
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

## Administration

| Method | Route | Purpose |
|---|---|---|
| `GET` / `PUT` | `/api/retrieval/settings` | Read/update active retrieval and merge settings (admin). |
| `GET` / `POST` | `/api/users` | List filtered, paginated user accounts or create an account (admin). |
| `PATCH` / `DELETE` | `/api/users/:id` | Update an account, or disable it after ownership transfer (admin). |
| `GET` / `POST` | `/api/providers` | List safe provider metadata or save provider configuration (admin). |
| `POST` | `/api/providers/test` | Test saved provider connectivity (admin). |
| `POST` | `/api/providers/gemini/validate` | Validate Gemini credentials and retrieve usable models. |
| `POST` | `/api/providers/azure/validate` | Validate Azure endpoint/key and retrieve available configuration. |
| `GET` | `/api/unanswered` | List unanswered questions for review. |
| `POST` | `/api/unanswered/request` | Create, or return the existing, expert request for a partial assistant response. |
| `POST` | `/api/unanswered/:id/review` | Publish or resolve an unanswered-question review. |
| `GET` | `/api/dashboard/summary` | Read dashboard metrics permitted to current user. |

`GET /api/users` accepts `page`, `pageSize` (10–100), `search`, `role` (`sales`, `technical`, `admin`) and `status` (`active`, `disabled`, `purged`). Its response contains `users` and `pagination` with `page`, `pageSize`, and `total`.

`POST /api/users` requires `fullName`, `username`, `email`, `password`, `passwordConfirmation`, and `role`. Usernames are 3–50 characters and limited to letters, digits, `.`, `_`, and `-`. Passwords must be 8–128 characters and contain uppercase and lowercase letters plus a special character; the confirmation must match.

`DELETE /api/users/:id` does not immediately erase the account. It requires `transferToUserId` and optionally `ticketAssigneeId`; the API transfers knowledge ownership and open expert requests, disables sessions and MFA, then marks the account for a 30-day retention period. The last active administrator cannot be disabled.

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
- `available`: the assistant answered only the verified portion; the user may create an expert request with POST /api/unanswered/request and a sourceMessageId.
- `created`: an expert request was created automatically because evidence was insufficient or a cited source requires expert confirmation. The response includes ticketId; clients should open that request rather than create another one.

POST /api/unanswered/request requires ticket:write, accepts only an assistant message owned by the current user in review mode, and is idempotent per source message.
