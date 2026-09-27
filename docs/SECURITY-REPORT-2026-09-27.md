# Security Report — 2026-09-27

## Scope and snapshot

- Project: `support-reply-assistant`
- Commit inspected: `8e3523323d642697371917c68cf3530f97988e6d` (`main`, also `origin/main` at audit start).
- Working tree: local-only, untracked data/artifact files exist and were not included in the committed source baseline. They were not opened or copied into this report.
- Scope: tracked Next.js API routes, session/RBAC, provider configuration, avatar upload/storage, secret exposure patterns, and production dependency advisories.
- Environment: local source audit on 2026-09-27; `npm run typecheck` passed. This is not a penetration test or a production infrastructure review.

## Summary

No common private-key/API-token pattern was found in tracked source, `.env.local` and local avatar storage are ignored, and reviewed protected API routes use server-side role/permission checks. Avatar upload is owner-bound, size-limited, decoded with `sharp`, normalized to WebP, and stored outside the web root.

Four findings remain open. Do not treat this report as production sign-off until the High findings and login protection are addressed.

## Findings

### SEC-001 — MEDIUM — Provider endpoint SSRF controls are a partial blocklist

- Status: OPEN (reassessed from prior `FIXED-UNVERIFIED`)
- Evidence: `lib/ai/providers.ts` and `app/api/providers/route.ts` reject HTTP, localhost and several IPv4 private ranges. They do not resolve DNS before connection or reject all non-public targets, such as link-local, IPv6/mapped IPv6, and DNS rebinding cases.
- Impact: a compromised Admin account could configure a provider endpoint that makes server-side requests to a network target the blocklist misses.
- Confidence: High for the incomplete validation; actual exploitability depends on production egress/DNS controls.
- Recommendation: allowlist approved provider hostnames/tenant patterns; resolve and validate every target address immediately before connection; enforce outbound network controls that deny private, link-local and metadata ranges.

### SEC-002 — MEDIUM — PostCSS advisory remains through Next.js

- Status: OPEN
- Evidence: `npm audit --omit=dev` resolves `next@15.5.25` and `postcss@8.4.31`; audit reports affected PostCSS advisories, including arbitrary file read/source-map disclosure paths. The available automatic fix is a major Next.js upgrade.
- Impact: the reported attack paths concern CSS/source-map processing. Reachability from this app's production request paths was not established, but the vulnerable dependency is present.
- Confidence: High for dependency presence; Medium for runtime reachability.
- Recommendation: plan a tested upgrade to a Next.js release that resolves the advisory; validate build, UI and deployment pipeline after the upgrade. Do not use `npm audit fix --force` without a compatibility review.

### SEC-003 — MEDIUM — Login and MFA verification lack rate limiting

- Status: OPEN
- Evidence: `app/api/auth/login/route.ts` verifies passwords directly and `app/api/auth/mfa/verify/route.ts` verifies TOTP codes; neither has an IP/account throttle, lockout, or failed-attempt telemetry.
- Impact: increases exposure to credential stuffing, password guessing and repeated MFA-code attempts.
- Confidence: High.
- Recommendation: apply distributed rate limits at reverse proxy/edge plus account-aware limits in the application; return generic responses, record failed attempts safely, and alert on abnormal patterns.

### SEC-005 — HIGH — Direct XLSX parser has unresolved security advisories

- Status: OPEN
- Evidence: `lib/knowledge/import.ts` calls `XLSX.read` on user-supplied XLSX input from `app/api/knowledge/import/route.ts`. `npm audit --omit=dev` reports `xlsx@0.18.5` affected by prototype-pollution and ReDoS advisories; no patched version is offered by the current package channel.
- Impact: an authenticated Knowledge editor can upload a crafted XLSX file. The likely impact is parser resource exhaustion or unsafe object handling in the import path; the exact exploit chain was not executed in this audit.
- Confidence: High for affected direct dependency and untrusted input reachability; Medium for full exploit impact.
- Recommendation: replace SheetJS `xlsx` with a maintained parser after compatibility testing, or isolate XLSX parsing in a constrained worker/container with strict CPU/memory/time limits. Keep the current 5 MB limit but do not rely on it alone against compressed/spreadsheet parser attacks.

## Controls verified

- Session cookies are `httpOnly`, `sameSite=lax`, use `secure` in production, expire after eight hours, and server session validation checks user status plus `session_version`.
- API authorization uses `requireRole` or `requirePermission` on reviewed business routes; conversation reads and expert-ticket creation enforce conversation ownership at query level.
- SQL in reviewed code uses positional parameters rather than user-input interpolation.
- Provider API keys are encrypted with AES-256-GCM and excluded from provider-list responses.
- Avatar upload accepts JPEG/PNG/WebP only, caps raw upload at 5 MB, validates image content with `sharp`, limits decoded pixels, server-generates the storage name, and reads only the current authenticated user's image.
- No `dangerouslySetInnerHTML`, `eval`, or dynamic function construction was found in tracked application source.
- No common private-key, GitHub token, Slack token, Gemini key or OpenAI-style key pattern was found in tracked files. This is a pattern scan, not proof that no secret has ever existed in Git history.

## Dependency audit result

`npm audit --omit=dev` reported 3 production dependency entries: 2 High (`postcss`, `xlsx`) and 1 Moderate (`next`). The PostCSS/Next chain is represented by SEC-002; the direct XLSX chain is represented by SEC-005.

## Not covered

- GitHub repository visibility/settings, historical secret rotation, branch protection and CI secrets.
- Production reverse proxy/WAF, TLS, host/container hardening, cloud IAM, backups and outbound egress.
- Browser-based authenticated authorization tests for every role, adversarial upload fuzzing, or exploit proof-of-concept execution.
