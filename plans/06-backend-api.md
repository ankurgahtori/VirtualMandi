# Plan 06 — Backend API

## Objective

Build the Fastify API required for authentication, admin BlogPost management, seeded data visibility, and the mobile feed.

## Files and modules

```text
apps/api/src/server.ts
apps/api/src/app.ts
apps/api/src/config.ts
apps/api/src/plugins/auth.ts
apps/api/src/plugins/error-handler.ts
apps/api/src/routes/auth.ts
apps/api/src/routes/posts.ts
apps/api/src/routes/admin-posts.ts
apps/api/src/services/auth-service.ts
apps/api/src/services/post-service.ts
apps/api/src/services/media-service.ts
apps/api/src/repositories/...
apps/api/test/...
```

## HTTP contract

Implement and document at minimum:

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `GET /v1/feed/posts?locale=&locationId=&categoryId=&cursor=&limit=`
- `GET /v1/posts/:id`
- `GET /v1/admin/posts?...`
- `POST /v1/admin/posts` for BlogPost first
- `PATCH /v1/admin/posts/:id`
- `POST /v1/admin/posts/:id/publish`
- `POST /v1/admin/posts/:id/archive`
- `POST /v1/admin/posts/:id/restore`
- `POST /v1/admin/posts/:id/remove`
- `GET /health` and `GET /ready`

Use shared request schemas and DTOs. Return a consistent error envelope with request ID, machine-readable code, message, and field errors. Never return password hashes, token values, or internal Prisma records.

## Auth behavior

- Normalize email and hash passwords with a modern adaptive algorithm.
- Registration must be safe against account enumeration and duplicate email races.
- Access tokens are bearer tokens in `Authorization: Bearer <token>`.
- Store only hashed refresh tokens/sessions; rotate and revoke on refresh/logout.
- Add role checks for admin routes and rate limiting for auth routes.
- Define expiry values in validated environment configuration.

## Post behavior

- Admin can create/update BlogPost translations, image/media, external URL, source, categories, and locations.
- Publishing requires valid English title/content and valid lifecycle state.
- Feed returns only `PUBLISHED`, non-removed posts and resolves requested locale → English.
- Admin list includes `createdAt`, source, external URL, type, status, crawler provenance, and missing translations.
- Use cursor pagination with deterministic ordering, for example `publishedAt DESC, id DESC`.

## Media behavior

Create a `MediaStorage` interface. Use LocalStack S3 for local/test and AWS S3 in production. The API owns credentials and can issue presigned upload/download URLs. Browser/mobile receive URLs or media DTOs, never AWS credentials.

## Tests and validation

- Unit-test auth, post lifecycle, locale fallback, filter construction, URL validation, and authorization.
- Integration-test every listed endpoint against Docker PostgreSQL and LocalStack.
- Run:

```bash
pnpm --filter @virtual-mandi/api typecheck
pnpm --filter @virtual-mandi/api test
pnpm --filter @virtual-mandi/api build
```

## Completion criteria

- [x] API exposes the seeded BlogPost.
- [x] Admin can manage BlogPost lifecycle.
- [x] Mobile can authenticate and fetch the filtered published feed.
- [x] API contract is documented for client agents.

## Implementation notes

- Added Fastify app/server/configuration, request IDs, consistent error envelopes, health/readiness endpoints, bearer access tokens, hashed rotating refresh sessions, logout revocation, admin role checks, and authentication rate limiting.
- Added public feed/detail routes with locale fallback and published-only visibility, plus admin BlogPost CRUD, lifecycle routes, and presigned S3/LocalStack upload URLs.
- Added DTO mapping so database records and password/token internals never leave the API boundary.
- API contract is documented in `apps/api/API.md`.
- Focused route tests and Docker-backed smoke tests pass. Full endpoint integration coverage remains a follow-up as admin/mobile clients are implemented.
