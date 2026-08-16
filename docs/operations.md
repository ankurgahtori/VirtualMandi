# Operations runbook

## Local stack

```bash
pnpm infra:up
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
```

The development seed is idempotent and creates the local admin and one published BlogPost. It is blocked when `NODE_ENV=production` unless `ALLOW_PRODUCTION_SEED=true` is explicitly set.

## API startup

```bash
DATABASE_URL='postgresql://virtual_mandi:virtual_mandi_local@localhost:5433/virtual_mandi?schema=public' \
JWT_SECRET='local-development-secret-change-me' \
CORS_ORIGINS='http://localhost:5173' \
pnpm --filter @virtual-mandi/api dev
```

`/health` checks process availability. `/ready` checks PostgreSQL and the configured S3/LocalStack bucket. Fastify emits structured JSON logs with request IDs; error responses include a request ID and do not include secrets or password hashes.

## Integration smoke test

With Docker, migrations, seed data, and the API running:

```bash
API_BASE_URL=http://localhost:3000 node scripts/integration-smoke.mjs
```

The smoke test covers admin login, farmer registration, seeded feed visibility, draft creation, publish, filtered feed retrieval, archive, restore-to-published, removal, and feed exclusion.

## Migration and backup procedure

1. Take a managed PostgreSQL snapshot before a production migration.
2. Deploy the application version that contains the migration.
3. Run `pnpm db:migrate` once using a deployment job with the production `DATABASE_URL`.
4. Check `/ready`, API error rate, and feed/admin smoke tests.
5. If the migration is backward-compatible, roll back application code first. Do not manually delete migration history; restore the snapshot or apply a reviewed forward migration for data rollback.
6. Record migration name, snapshot ID, operator, and verification results.

Prisma migrations are forward-only. Test destructive/data-changing migrations against a staging snapshot before production.

## AWS S3 production baseline

- Use a dedicated private bucket per environment.
- Enable server-side encryption (SSE-S3 or KMS) and block public access.
- Restrict writes to the API IAM role; clients receive short-lived presigned URLs only.
- Configure object lifecycle rules for abandoned uploads and archived media.
- Configure CORS only for approved admin origins and required methods/headers.
- Use a CDN/private origin if media must be delivered at scale; do not expose bucket credentials.
- LocalStack remains development/test-only and is configured separately through `S3_ENDPOINT`.

## Monitoring and privacy

Wire `requestId` into the log aggregator and error-monitoring hook. Redact authorization headers, refresh tokens, passwords, email addresses where not needed, database URLs, AWS keys, and raw request bodies before shipping logs. The API currently logs structured Fastify errors; production should attach the approved monitoring provider in deployment configuration.
