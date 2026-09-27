# Deployment Readiness

## Target

The application is packaged for a container-based deployment with:

- Next.js production server (`npm run build && npm start`)
- PostgreSQL 16 + pgvector as the database
- TLS termination and secure `AUTH_SECRET` / `SECRETS_ENCRYPTION_KEY` injection at the platform layer
- Database migration before application start: `npm run db:migrate`
- Health probe: `GET /api/health`
- Persistent storage for `USER_STORAGE_DIR` (default `./storage/users`) so user avatars survive application restarts

The local reference target is Docker Compose. A production platform/hostname, backup policy, and release approval are intentionally not assumed by this repository.

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
