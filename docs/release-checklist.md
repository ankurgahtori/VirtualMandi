# Release checklist

- [ ] CI is green for the exact commit being deployed.
- [ ] `pnpm install --frozen-lockfile`, Prisma validate/generate, migrations, format, lint, typecheck, tests, and builds pass.
- [ ] Staging Docker/integration smoke test passes.
- [ ] PostgreSQL backup/snapshot is recorded before migration.
- [ ] Production `DATABASE_URL`, `JWT_SECRET`, AWS credentials, bucket, endpoint, and `CORS_ORIGINS` are configured in the secret manager.
- [ ] `NODE_ENV=production` is set; development seed is not run against production.
- [ ] S3 bucket is private, encrypted, lifecycle-managed, and limited to the API IAM role.
- [ ] Presigned upload URL expiry and upload size/content-type limits are reviewed.
- [ ] CORS origins are exact production origins; no wildcard is used with bearer credentials.
- [ ] Access/refresh token TTLs, password hashing cost, and auth rate limits are reviewed.
- [ ] `/health` and `/ready` checks pass after deployment.
- [ ] Admin can log in and inspect seeded/staging content.
- [ ] Mobile iOS/Android bundles are verified with the release API URL.
- [ ] Browser/mobile bundles contain no Prisma client, database URL, AWS keys, JWT secret, or signing files.
- [ ] Crawler source terms, rate limits, legal approval, and supported locales are documented before enabling real adapters.
- [ ] Future music/video post types remain behind explicit contracts and are not enabled accidentally.
