# Plan 05 — Backend API

## Goal

Build the Node.js TypeScript API that authenticates users, manages editorial content, and serves the mobile feed.

## Scope

- Bootstrap `apps/api` with Fastify, structured logging, configuration validation, CORS, and centralized error handling.
- Implement self-registration and email/password authentication:
  - password hashing with a modern adaptive algorithm
  - registration, login, logout, and bearer access-token issuance
  - refresh-token/session rotation and revocation behind the bearer-token API
  - safe responses that do not reveal whether an email exists
  - rate limiting and basic brute-force protections
- Implement authorization for authenticated users and admin/editor operations.
- Implement content endpoints for create, update, list by state, publish, archive, restore, and soft-remove.
- Implement the mobile feed endpoint with stable ordering, pagination, and only published/non-deleted content.
- Support feed filtering by requested language, location, and category, with English translation fallback when a requested translation is unavailable.
- Apply `Asia/Kolkata` consistently to daily-content boundaries and document UTC storage versus IST presentation/query behavior.
- Return shared DTOs and validation errors from `@virtual-mandi/shared`.
- Add OpenAPI documentation or an equivalent generated API contract.
- Add health/readiness endpoints and database error handling.
- Add unit and integration tests with an isolated test database strategy.

## Media boundary

Use a `MediaStorage` interface with two implementations: AWS S3 for deployed environments and LocalStack S3 for development/tests. The API must not hard-code a provider or expose AWS credentials to admin/mobile clients. Configure the LocalStack endpoint, region, bucket, and dummy development credentials through environment variables. Prefer presigned upload/download flows where applicable.

## Security requirements

- Never return password hashes or raw refresh tokens.
- Validate body, params, query, and uploaded/media URLs.
- Enforce ownership/role checks on admin mutations.
- Configure production CORS and bearer-token behavior explicitly; do not use permissive defaults silently.
- Validate environment-specific configuration for database, bearer-token signing/verification, AWS S3/LocalStack endpoint, bucket, region, and credentials.

## Validation

- API unit tests and integration tests.
- `pnpm --filter @virtual-mandi/api typecheck`
- `pnpm --filter @virtual-mandi/api test`
- Exercise auth, lifecycle transitions, active feed filtering, pagination, and unauthorized requests.

## Definition of done

- Admin and mobile clients have documented endpoints they can use without direct database access.
- Auth and content lifecycle behavior is covered by automated tests.
- The API can run locally against the Prisma schema and provides operational health checks.
