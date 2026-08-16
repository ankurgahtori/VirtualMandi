# Plan 05 — Content ingestion, crawling, and seeded posts

## Objective

Make crawler/manual input safe, normalized, deduplicated, and reusable by both development seed data and future scheduled crawling.

## Package boundaries

- `packages/shared`: input/output schemas only.
- `packages/database`: persistence/repository only.
- `apps/api` or a server-only `packages/ingestion`: adapters, normalization, orchestration.
- Crawler adapters must never import Prisma directly.

## Normalized input

Implement a `NormalizedBlogPostInput` with:

- stable external identity (`source`, `sourceItemId` or canonical URL)
- source enum: WhatsApp, website, manual
- title/content in one or more locales
- optional image URL or local fixture key
- optional external redirect URL
- category/location keys
- discoveredAt/fetchedAt and crawler metadata
- requested initial status, defaulting to draft for crawler input

Normalize whitespace, URLs, locale aliases, HTML/sanitized content, and source keys before persistence. Reject unsafe URL schemes and oversized/unusable content.

## Ingestion behavior

1. Parse adapter input.
2. Validate with shared schemas.
3. Normalize fields.
4. Resolve or create allowed category/location keys through repositories.
5. Check stable ingestion identity/canonical URL.
6. Upsert or report duplicate according to an explicit policy; never create silent duplicates.
7. Create `Post` with `BLOG_POST` type and `BlogPost` details/translations in a transaction.
8. Keep crawled posts `DRAFT` unless a trusted publish command is explicitly used.
9. Return counts: accepted, created, updated, skipped duplicate, rejected, errors.

## Seed implementation

Seed data should be a small checked-in fixture, not hidden inline in a giant script:

```text
packages/database/src/seed/fixtures/blog-posts.ts
packages/database/src/seed/user.seed.ts
packages/database/src/seed/locale.seed.ts
packages/database/src/seed/location.seed.ts
packages/database/src/seed/category.seed.ts
packages/database/src/seed/media.seed.ts
packages/database/src/seed/post.seed.ts
packages/database/src/seed/blog-post.seed.ts
packages/database/src/seed/index.ts
```

The fixture must include title, image, content, external redirect URL, source, category, location, and English translation. Use LocalStack S3 for the image fixture or a deterministic remote-safe placeholder approved by the implementation.

## Crawler adapters

Create interfaces for website and WhatsApp ingestion, but implement only a deterministic fixture adapter in v1. Do not scrape real websites or connect to WhatsApp until legal, terms-of-service, rate-limit, and credential requirements are explicitly approved. Add retry/backoff and structured logs only when real adapters are introduced.

## Validation

Run migrations and seed twice. Assert stable counts and IDs. Test malformed input, unsafe URLs, duplicate source identity, missing English translation, and transaction rollback. Verify the seeded post is returned by the API query used by admin/mobile.

## Completion criteria

- Seeded BlogPost is available for the first vertical slice.
- Ingestion is reusable by future crawlers and does not bypass editorial status controls.
- Failure reports are actionable and do not expose credentials or raw secrets.
