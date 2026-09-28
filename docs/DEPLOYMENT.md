# Deployment Readiness

## Target

The application is packaged for a container-based deployment with:

- Dockerfile production contract, automatically detected by container platforms such as Vibe Host
- Next.js production server (`npm run build` then `npm run deploy:start`)
- PostgreSQL 16 + pgvector as the database
- TLS termination and secure `AUTH_SECRET` / `SECRETS_ENCRYPTION_KEY` injection at the platform layer
- Idempotent database migration before application start: `npm run deploy:release`
- Health probe: `GET /api/health`
- Persistent storage for `USER_STORAGE_DIR` (default `./storage/users`) so user avatars survive application restarts

The local reference target is Docker Compose. A production platform/hostname, backup policy, and release approval are intentionally not assumed by this repository.

## Vibe Host deployment contract

When the linked Git repository receives a commit, Vibe Host can build from the repository `Dockerfile`. The image entrypoint validates required secrets, runs `npm run deploy:release` (which runs `db:migrate`) and only then starts the web server. This makes new tables, columns and indexes available before code that reads them accepts traffic.

Set these values in the Vibe Host secret/environment manager, never in Git:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Attached PostgreSQL connection string. |
| `AUTH_SECRET` | Yes | Long random session secret. |
| `SECRETS_ENCRYPTION_KEY` | Yes | 32-byte base64 key used for encrypted provider credentials. |
| `APP_URL` | Yes | Final HTTPS application URL. |
| `USER_STORAGE_DIR` | Yes | Mount this path to persistent storage; default image path is `/var/lib/support-reply-assistant/users`. |
| `TRUST_PROXY` | Conditional | Set `true` only behind a trusted proxy that strips and rewrites forwarded-IP headers. |
| `PORT` | Platform | Defaults to `3000`; Vibe Host may inject it. |

Configure the platform health probe as `GET /api/health` on port `3000` (or its injected `PORT`). Attach the persistent volume at `/var/lib/support-reply-assistant/users` so avatars remain after redeploys. The app container must have one release/migration runner at a time; if Vibe Host supports a **pre-deploy/release command**, prefer `npm run deploy:release` there and use `npm run deploy:start` as the web start command.

For operational-log cleanup, create a separate scheduled task in Vibe Host:

```sh
npm run operational-logs:retention -- --apply
```

It is safe to run repeatedly and only deletes log rows older than the Admin-configured retention period.

Schedule this separate cleanup task daily after the application migration has run:

```sh
npm run auth-rate-limits:retention -- --apply
```

The application enforces login and MFA limits in PostgreSQL, so all web instances share the same counters. Keep an edge/WAF limit as a second layer; do not trust client-supplied forwarding headers unless `TRUST_PROXY=true` is configured with a verified proxy contract.

## Release checklist

- [x] Production build passes.
- [x] Database migration and seed scripts pass locally.
- [x] Health, login, session, provider permission, and full knowledge-loop smoke tests pass locally.
- [x] Protected UI routes redirect unauthenticated users.
- [ ] Set production secrets through the deployment secret manager.
- [ ] Configure TLS, domain, database backups, monitoring, and egress policy.
- [ ] Mount and back up persistent `USER_STORAGE_DIR`; do not serve it directly as a public web directory.
- [ ] Resolve or formally accept the open PostCSS advisory.
- [ ] Run a production-like deployment rehearsal and rollback test.

No production deployment was executed in this phase because no deployment target or release authorization was provided.
