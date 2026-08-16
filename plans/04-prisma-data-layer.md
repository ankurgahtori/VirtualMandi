# Plan 04 — Prisma data layer

## Status

Implemented. The Prisma schema, initial migration, generated server-only client, repositories, LocalStack media fixture, and repeatable seed runner are working against Docker PostgreSQL.

## Objective

Implement the PostgreSQL schema, migrations, server-only Prisma package, and query helpers for the typed-post domain.

## Files and ownership

- `prisma/schema.prisma`: only schema source of truth.
- `prisma/migrations/`: committed migration history.
- `packages/database/src/client.ts`: Prisma singleton/shutdown.
- `packages/database/src/repositories/post-repository.ts`: typed post queries.
- `packages/database/src/repositories/user-repository.ts`: auth queries.
- `packages/database/src/seed/`: seed runner and ordered modules.
- `packages/database/src/index.ts`: server-only exports.

## Required models

Implement the equivalent of:

- `User`: id, email unique, passwordHash, role, createdAt, updatedAt, optional disabledAt.
- `RefreshSession`: id, userId, tokenHash, expiresAt, revokedAt, createdAt, updatedAt, device metadata.
- `Post`: id, type, status, createdAt, updatedAt, publishedAt, archivedAt, removedAt, createdById, updatedById, stable ingestion identity.
- `BlogPost`: postId unique, image/media reference, externalRedirectUrl, source, crawler provenance fields.
- `BlogPostTranslation`: blogPostId, locale/language, title, content, unique `(blogPostId, locale)`, createdAt, updatedAt.
- `Locale`, `Category`, `Location`, and post-to-category/location relations.
- `MediaAsset`: id, provider, bucket, objectKey, mimeType, size, public/presigned URL metadata, createdAt.

Use explicit foreign-key behavior. Prefer soft deletion and status transitions over physical deletes. Add indexes for email, status/publishedAt, type, source, locale, category, location, and ingestion identity.

## Seed ordering

The seed runner must call modules in this order and fail with a named module if a module errors:

```text
user → locale → location → category → media → post → blogPost → translations → publish/filter relations
```

Every module must use stable IDs or natural-key upserts. `post.seed.ts` creates a `BLOG_POST`; `blog-post.seed.ts` attaches its details; translation seed creates English content; final seed publishes it. A second run must keep the same IDs/counts.

## Commands

```bash
pnpm infra:up
pnpm prisma:validate
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
pnpm db:reset   # development only; explicit destructive warning
```

`db:migrate` must use deployable migrations, not silently use `db push`.

## Tests

Use Docker PostgreSQL or an isolated test database. Test schema migration, seed idempotency, English publish constraint, Post/BlogPost relation, status transitions, feed filters, translation fallback, and soft removal.

## Completion criteria

- Fresh Docker PostgreSQL migrates successfully.
- Seed creates at least one published English BlogPost with image/media reference, external URL, source, category, location, and `createdAt`.
- API can import database package; browser/mobile cannot.
- Migration and seed commands are documented and repeatable.
