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

- [x] Seeded BlogPost is available for the first vertical slice.
- [x] Ingestion is reusable by future crawlers and does not bypass editorial status controls.
- [x] Failure reports are actionable and do not expose credentials or raw secrets.

## Implementation notes

- Added the server-only `@virtual-mandi/ingestion` package with adapter interfaces, a deterministic website fixture adapter, normalization, stable source identity detection, draft-by-default persistence, and structured ingestion results.
- Ingestion persistence uses a Prisma transaction and resolves locales, categories, and locations before writing the typed `Post`/`BlogPost` graph. The default duplicate policy is `skip`; callers can explicitly request `update`.
- Shared ingestion validation now requires `sourceItemId` or `canonicalUrl`, accepts only HTTP(S) URLs, supports `discoveredAt`/`fetchedAt`, and normalizes supported locale aliases.
- Added `ChiniMandiAdapter` (`packages/ingestion/src/chinimandi.ts`), a real website adapter approved by the user that reads the public WordPress REST API (`/wp-json/wp/v2/posts`) instead of parsing HTML. It defaults to category 14 ("Indian Sugar News in Hindi"), paginates politely (1s between pages), and maps posts to stable `chinimandi-<wpId>` identities with hi-IN text plus a mirrored en-IN fallback (the site publishes no English copy for this listing).
- Run it with `pnpm --filter @virtual-mandi/ingestion crawl:chinimandi` (flags: `--after <iso>`, `--pages`, `--per-page`, `--category`, `--update`, `--draft`). The user approved direct publishing for this source, so the CLI ingests as `PUBLISHED` by default (`--draft` opts out); `ingestBlogPosts` still defaults to `DRAFT` for programmatic callers. Safe to run daily — the default `skip` duplicate policy dedups on source identity. Example cron: `0 6 * * * cd <repo> && pnpm --filter @virtual-mandi/ingestion crawl:chinimandi`.
- Added `KrishiJagranAdapter` (`packages/ingestion/src/krishijagran.ts`), a real website adapter approved by the user for the krishijagran.com commodity-news listing. There is no WordPress API, so it scrapes the server-rendered listing HTML (`.nc-item`/hero cards), paginates via the site's own `/api/MoreStories?c=<categoryId>&l=<lastId>` JSON endpoint (the "View More" button), and fetches each story page for `<article>` paragraphs plus NewsArticle ld+json metadata (title, description → summary, image, datePublished for `--after`). Identity is `krishijagran-<slug>`; defaults to `market-prices` + `india`, en-IN only.
- Run it with `pnpm --filter @virtual-mandi/ingestion crawl:krishijagran` (flags: `--after <iso>`, `--pages`, `--category-path`, `--delay-ms`, `--update`, `--draft`). Same publishing/duplicate semantics as the ChiniMandi CLI — PUBLISHED by default, `skip` on duplicates. First run ingested all 29 listing-page stories with images.
- Featured images are downloaded and re-hosted into S3/LocalStack via `createRemoteImageResolver` (`packages/ingestion/src/image-resolver.ts`), keyed `crawled/<sourceItemId>.<ext>`, with a `MediaAsset` upsert per image. Feed clients need `S3_PUBLIC_BASE_URL` set (e.g. `http://localhost:4566/virtual-mandi-local` locally) for `image.url` to resolve.
- WhatsApp integration remains intentionally unimplemented until legal, credentials, rate-limit, and operational requirements are approved.
