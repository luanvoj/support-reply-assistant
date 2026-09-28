# Security Audit Report — 2026-09-28

## Scope and snapshot

- Project: `support-reply-assistant`
- Scope: authentication/session, RBAC and object authorization, secret/API-key handling, login/MFA brute-force controls, upload/SSRF surfaces, dependency advisories, Docker/env handling.
- Working tree: dirty; pre-existing modified files `next-env.d.ts`, `package-lock.json`, `package.json`, `tsconfig.json`, plus untracked `skills.zip`. No source changes were made by this audit.
- Environment: local Windows workspace; static review plus `npm audit --omit=dev --json`; no authenticated black-box API test credentials were used.
- Tooling: repository source review, `npm audit --omit=dev`.

## Executive summary

- RBAC/session design: PASS for the reviewed authorization path. API guards re-read the user's current role/status/session version from the database, so changing a signed JWT payload is not a privilege escalation path.
- Secret/API-key handling: PASS for the reviewed provider storage path, with one operational caveat: compromise of `SECRETS_ENCRYPTION_KEY` and database access together exposes stored provider keys.
- Password brute-force protection: FAIL. `/api/auth/login` has no IP, identity, account, or global rate limit. MFA verification also lacks a request-level rate limit.
- Dependency: HIGH advisory for direct dependency `xlsx@0.18.5`; the ReDoS advisory is reachable from authenticated knowledge import/preview flows and should be treated separately from the login controls.

## Findings

### SEC-001 — Login endpoint has no brute-force rate limit

- Severity: High
- Status: OPEN
- Confidence: High
- Evidence: `app/api/auth/login/route.ts:16-40` performs database lookup and bcrypt verification, but has no rate-limit check, failure counter, lockout/backoff, or `Retry-After` response.
- Reproduction: send repeated POST requests with invalid credentials to `/api/auth/login`; each request reaches the database and `bcrypt.compare`.
- Impact: an attacker can perform online password guessing and cause avoidable database/bcrypt resource consumption. A leaked or weak password can be tested at scale.
- Expected: enforce a distributed rate limit keyed at minimum by source IP and normalized identity, with progressive backoff and safe generic errors; keep successful login and failure events observable.

### SEC-002 — MFA verification has no request-level rate limit

- Severity: Medium
- Status: OPEN
- Confidence: High
- Evidence: `app/api/auth/mfa/verify/route.ts:12-29` verifies the six-digit code but does not maintain an attempt counter or rate limit. The setup verification path has a database counter in `app/api/profile/mfa/route.ts:37-46`, but the login challenge path does not.
- Impact: a stolen pending MFA cookie or repeated requests against a valid pending session can receive unlimited online guesses during the five-minute window.
- Expected: add an atomic attempt limit/backoff for the pending session and identity, plus an IP limit; invalidate the pending challenge after repeated failures.

### SEC-003 — Admin MFA is optional, so a leaked admin password is sufficient for admin takeover

- Severity: High
- Status: OPEN
- Confidence: High
- Evidence: `app/api/auth/login/route.ts:32-37` creates a normal session whenever `mfa_enabled_at` is absent. User creation allows an admin to create any role in `app/api/users/route.ts:54-69`, and role-changing is admin-only in `app/api/users/[id]/route.ts:19-35`.
- Impact: a leaked non-admin password does not appear to grant admin privileges through the reviewed server-side guards, but a leaked password belonging to an admin account directly grants full administrative access unless MFA was independently enabled.
- Expected: require MFA for every admin account, preferably at account creation/enrollment, and prevent activation of an admin account without a verified second factor. Keep server-side `requireRole` checks as the authority.

### SEC-004 — `xlsx@0.18.5` has known high-severity advisories

- Severity: High
- Status: OPEN
- Confidence: High
- Evidence: `npm audit --omit=dev --json` reports direct dependency `xlsx` with prototype pollution advisory `GHSA-4r6h-8v6p-xvw6` for `<0.19.3` and ReDoS advisory `GHSA-5pgg-2g8v-p4x9` for `<0.20.2`; installed range is declared in `package.json:38` as `^0.18.5`. Audit reports no automatic fix.
- Reachability: `lib/knowledge/import.ts` imports `xlsx`; authenticated import and preview routes invoke that parsing path after `requirePermission("knowledge:write")`.
- Impact: malicious spreadsheet content can cause denial of service and may expose parser-related integrity risk. Authentication is required for the reviewed application path, but the upload is still an attacker-controlled input surface.
- Expected: replace or isolate the vulnerable parser, or adopt a maintained version/alternative after compatibility testing; enforce strict upload size/row/sheet limits and run parsing in a constrained worker/process.

## Controls that passed review

- Signed HS256 session JWTs are verified with `AUTH_SECRET`; the server re-reads current role, status, and `session_version` from the database in `lib/auth/session.ts:53-75`.
- API routes reviewed use `requireRole` or `requirePermission`; admin-only user/provider/configuration actions are server-side guarded.
- Passwords are bcrypt-hashed with 12 salt rounds in `lib/auth/password.ts:3-10`; password changes increment `session_version` and invalidate existing sessions.
- Provider API keys are not returned by the provider GET route and are encrypted with AES-256-GCM in `lib/security/secrets.ts:5-25` before database storage in `app/api/providers/route.ts:73-120`.
- Provider endpoint validation requires HTTPS and rejects localhost/private IPv4 targets in `app/api/providers/route.ts:20-37`, reducing the reviewed SSRF path.
- Session cookies are `httpOnly`, `sameSite=lax`, have an eight-hour expiry, and use `secure` in production in `lib/auth/session.ts:26-33`.
- Avatar storage uses server-generated paths, content validation, size limits, and WebP normalization; storage is outside the web root.

## Not run / limitations

- No live authenticated brute-force test was run against the local app.
- No production reverse-proxy/WAF configuration was available; an external rate limiter may exist outside this repository, but none is enforced in application code.
- No secret values were printed or included in this report. Existing `.env.local` is ignored by Git; rotation is required if any real secret was ever committed or exposed outside the intended host.

## Recommended remediation order

1. Add distributed login rate limiting and progressive backoff; add equivalent MFA challenge limits.
2. Make MFA mandatory for admin accounts and add tests proving non-admin cannot invoke admin routes or change roles.
3. Replace/upgrade the vulnerable `xlsx` path and add bounded spreadsheet parsing.
4. Add automated authorization and rate-limit regression tests, then run authenticated black-box verification.

## Remediation update — 2026-09-28

- SEC-001: FIXED-UNVERIFIED. Added PostgreSQL-backed global, normalized-identity and proxy-aware IP limits to `POST /api/auth/login`; blocked requests return `429` with `Retry-After` and retain the generic credential error.
- SEC-002: FIXED-UNVERIFIED. Added PostgreSQL-backed pending-challenge and proxy-aware IP limits to MFA login verification. The fifth invalid code blocks and clears the pending challenge; the limiter threshold was exercised against the local database.
- SEC-003: ACCEPTED (MVP policy). Admin MFA remains optional by explicit product decision; this is not represented as a technical remediation.
- SEC-004: FIXED-UNVERIFIED. Replaced `xlsx` with `exceljs@4.4.0` and an explicit `uuid@11.1.1` override. `npm audit --omit=dev --json` reports zero vulnerabilities, and the XLSX import smoke test passes.

Verification completed: database migration, TypeScript check, production build, XLSX import smoke test, rate-limit threshold smoke test and production dependency audit. Authenticated browser/API end-to-end throttling and production proxy/WAF verification remain not run.
