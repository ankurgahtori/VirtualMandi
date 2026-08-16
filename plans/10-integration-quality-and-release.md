# Plan 10 — Integration, quality, and release hardening

## Objective

Prove the complete system works together and document how to run it safely in staging/production.

## End-to-end scenario

Against clean Docker PostgreSQL + LocalStack:

1. Migrate and seed.
2. Admin logs in and reads seeded BlogPost.
3. Mobile registers/logs in and reads published feed.
4. Admin creates a draft BlogPost with source, image, external URL, category, location, and English content.
5. Admin publishes it.
6. Mobile retrieves it with requested locale/filter.
7. Admin archives it.
8. Mobile no longer receives it.
9. Admin restores it and mobile receives it again.
10. Run seed twice and verify no duplicate records.

## CI

Add jobs for install/cache, format, lint, typecheck, unit tests, Prisma validate/generate, migration/integration tests, API/admin builds, and mobile typecheck/build checks appropriate to Expo. Start service containers or Compose with health checks. Do not use production credentials.

## Operational requirements

- Structured JSON logs and request IDs.
- `/health` for process and `/ready` for database/storage dependencies.
- Error monitoring hook with secrets/PII redaction.
- Migration deploy procedure and backup/rollback guidance.
- AWS S3 production bucket policy, encryption, lifecycle, CORS, CDN, and private/public URL decisions.
- LocalStack configuration kept separate from staging/production.
- Environment variable inventory with owner and exposure classification.

## Release checklist

- No secrets, tokens, dumps, signing keys, or generated credentials committed.
- Production build contains no Prisma client in browser/mobile bundles.
- CORS, bearer token, password hashing, rate limits, and upload limits reviewed.
- Seed fixtures are development-only and production seed command is disabled or explicitly guarded.
- Database backup and migration plan tested in staging.

## Completion criteria

The critical admin-to-API-to-mobile journey is automated, staging is reproducible, and known limitations—including crawler compliance, supported locales, and future post types—are documented.
