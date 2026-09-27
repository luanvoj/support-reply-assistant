# Security Report — 2026-09-22

## Scope and snapshot

- Project: `support-reply-assistant`
- Snapshot: working tree based on commit `ed79c1a`, with local implementation changes not committed.
- Scope: Next.js API routes, session/RBAC, provider secret handling, database access, frontend env exposure, tracked secret-like files, and npm dependency advisories.
- Runtime: local PostgreSQL/pgvector on `localhost:5432`, local Next production server on `localhost:3000`.
- Tools: `rg`, source inspection, `npm audit --omit=dev`, production build, runtime smoke script.

## Summary

No tracked credential file or raw API key was found in the project tree. Provider keys are encrypted with AES-256-GCM and are not returned by the provider list API. API routes use server-side session permission checks.

The audit found two open findings and two hardening items. This is not a production security sign-off while the open findings remain unresolved.

## Findings

### SEC-001 — MEDIUM — Provider endpoint can be used for server-side requests

- Status: FIXED-UNVERIFIED
- Evidence: `lib/ai/providers.ts` now rejects non-HTTPS/private-local endpoints at runtime; `app/api/providers/route.ts` rejects them on create. Existing production records still require a data migration/review.
- Impact: a compromised or abused admin account could configure an internal/private URL and make the application issue requests from the server network (SSRF risk). The provider test and chat failover can reach that endpoint.
- Confidence: High.
- Recommendation: restrict provider endpoints to HTTPS and an explicit organization allowlist, or require an approved provider type/tenant configuration. Add DNS/IP validation and egress controls at deployment.

### SEC-002 — MEDIUM — Dependency advisory in PostCSS through Next.js

- Status: OPEN
- Evidence: `npm audit --omit=dev` reports 1 high and 1 moderate advisory in `postcss`, pulled through the current Next.js dependency range. The suggested automatic fix upgrades Next.js across a major version.
- Impact: build/toolchain processing may be exposed to the reported PostCSS issues if attacker-controlled CSS/source maps enter the build pipeline.
- Confidence: High for dependency presence; runtime exploitability in this app was not established.
- Recommendation: schedule a controlled Next/PostCSS upgrade, run build and UI regression tests, then re-run audit. Do not use `npm audit fix --force` blindly.

### SEC-003 — MEDIUM — Login endpoint has no rate limiting

- Status: OPEN
- Evidence: `app/api/auth/login/route.ts` verifies credentials but has no IP/account attempt throttle or lockout.
- Impact: increases exposure to password guessing against deployed accounts.
- Confidence: High.
- Recommendation: add distributed rate limiting at the edge/reverse proxy and application-level failed-attempt telemetry before production.

### SEC-004 — LOW — UI route access is not server-guarded

- Status: FIXED-UNVERIFIED
- Evidence: `middleware.ts` now redirects protected operational routes to `/login`; runtime check returned `307 http://localhost:3000/login` for unauthenticated `/assistant`.
- Impact: unauthenticated users can see static shell/demo content. Sensitive database data is not returned without API authorization, but the UX should redirect unauthenticated users.
- Confidence: High.
- Recommendation: add middleware or server-side session checks for protected operational routes, with `/login` as the redirect target.

## Controls verified

- Session cookie is httpOnly, sameSite=lax, secure in production, and expires after 8 hours.
- Permission checks cover chat, knowledge, ticket, conversation, and admin provider routes.
- Conversation IDs are checked against the authenticated user before message insertion.
- SQL uses parameterized queries; no interpolated user value was found in reviewed query parameters.
- Provider secrets are encrypted server-side and excluded from `GET /api/providers` responses.
- No project-tracked `.env`, `stitch.md`, `.mcp.json`, private key, or raw API-key pattern was found.
- Runtime smoke passed: health, admin login, session/me, and admin provider access.
- Full local loop passed: article creation/chunking → assistant fallback → unanswered queue → review/publish/re-index → dashboard summary.

## Not covered

- Cloud IAM, reverse proxy/WAF configuration, container host hardening, production network egress, and real provider account permissions.
- Penetration testing or exploit validation of the PostCSS advisories.
- Rotation/revocation of any historical credential that may have existed outside this project tree; this requires the Google Cloud owner to rotate it.
