# Plan 03 — Prisma data layer

## Goal

Define the PostgreSQL schema and a reusable, server-safe Prisma package while keeping generated database code out of client bundles.

## Scope

- Add `prisma/schema.prisma` at the repository root.
- Configure PostgreSQL through `DATABASE_URL` and document local development setup, with `Asia/Kolkata` as the application timezone convention.
- Model at minimum:
  - users/accounts
  - refresh sessions or refresh tokens
  - content items and publication/lifecycle metadata
  - localized content translations with language and English fallback support
  - media assets and media variants/metadata as needed
  - categories and location hierarchy/filter relations
  - users/accounts and self-registration fields
  - audit fields and soft deletion/archive metadata
- Add indexes for active feed ordering, lifecycle filtering, email lookup, publication date, language, location, and category.
- Add migrations and a deterministic, idempotent development seed runner.
- Configure `packages/database` to export the Prisma client, lifecycle-safe helpers, transaction utilities, and seed orchestration entry points.
- Add graceful client shutdown and a development-friendly singleton pattern.
- Add a checked-in schema and migration policy; do not check in secrets or production data.
- Add ordered seed modules, for example `user.seed.ts`, `location.seed.ts`, `category.seed.ts`, `content.seed.ts`, and `translation.seed.ts`, with explicit ordering and upsert/idempotency rules so foreign keys always exist before dependents.
- Define `pnpm db:seed`/`npm run seed` behavior as migrate/prepare database first, then execute seed modules in order; make reset and seed behavior explicit for development only.

## Important boundary

Only `apps/api` and server-side packages may import `@virtual-mandi/database`. The admin browser bundle and React Native bundle consume shared DTOs, never Prisma Client.

## Validation

- Start a local PostgreSQL instance using the chosen repository-supported method.
- `pnpm prisma validate`
- `pnpm prisma generate`
- `pnpm prisma migrate deploy`
- `pnpm db:seed` and the documented `npm run seed` equivalent
- Run the seed command repeatedly and confirm it does not duplicate records or violate foreign-key constraints.
- `pnpm --filter @virtual-mandi/database typecheck`

## Definition of done

- A fresh database can be migrated and seeded reproducibly.
- Generated client imports work from the API package.
- Soft-delete/archive behavior and active-feed queries are covered by tests or repository helpers.
