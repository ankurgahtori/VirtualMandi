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
- Added `BusinessLineAdapter` (`packages/ingestion/src/businessline.ts`) for The Hindu BusinessLine's `/economy/agri-business/` section. No WordPress API and the RSS feed carries only summaries, so it scrapes the server-rendered listing HTML (picture + headline anchors merged per `article<id>.ece` URL), paginates with plain `?page=N` (out-of-range pages 301 back to the section root, which stops the walk), and fetches each story page for `<div itemprop="articleBody">` paragraphs plus `og:`/`article:published_time` meta. Identity is `businessline-<articleId>`; defaults to `news` + `india`, en-IN only.
- Run it with `pnpm --filter @virtual-mandi/ingestion crawl:businessline` or `pnpm ingest:businessline` (flags: `--after <iso>`, `--pages`, `--category-path`, `--delay-ms`, `--update`, `--draft`). Same publishing/duplicate semantics as the other CLIs — PUBLISHED by default, `skip` on duplicates. First run ingested all 13 listing-page stories; a repeat run produced 13 duplicates, 0 created.
- Featured images are downloaded and re-hosted into S3/LocalStack via `createRemoteImageResolver` (`packages/ingestion/src/image-resolver.ts`), keyed `crawled/<sourceItemId>.<ext>`, with a `MediaAsset` upsert per image. Feed clients need `S3_PUBLIC_BASE_URL` set (e.g. `http://localhost:4566/virtual-mandi-local` locally) for `image.url` to resolve.
- Added `SyncSource`/`SyncSourceCategory` tables (migration `add_sync_sources`) so crawlable sites and listing URLs live in the database instead of the source registry. `Post` rows link back via `syncSourceId`/`syncSourceCategoryId`, stamped explicitly by admin category syncs and auto-resolved from `canonicalUrl` in `ingestBlogPosts` for CLI runs. `packages/database/src/seed/sync-source.seed.ts` seeds the three adapters' sources/categories and backfills existing posts.
- Added `packages/ingestion/src/sync-cli.ts`, a generic registry-driven CLI that replaces per-source CLIs: `tsx src/sync-cli.ts --adapter-key <key> --listing-url <url> [--config '<json>'] [--after <iso>] [--pages <n>] [--delay-ms <n>] [--update] [--draft]`. It walks `INGESTION_ADAPTERS` the same way admin syncs do, ingests as PUBLISHED by default with image re-hosting, and attributes posts to the `SyncSourceCategory` matching `--listing-url` (needed for sites like Agriculture Dive and The Hindu where article URLs live outside the listing path — `canonicalUrl` prefix resolution only finds the source there).
- Added four more adapters approved by the user, all registered in `INGESTION_ADAPTERS` and seeded in `sync-source.seed.ts` (shared HTML helpers extracted to `packages/ingestion/src/html.ts`):
  - `EconomicTimesAdapter` (`economictimes.ts`) — discovers the section's RSS feed from `<link rel="alternate" type="application/rss+xml">` (or `adapterConfig.feedUrl` directly), then fetches each article for NewsArticle ld+json + `<article>` paragraphs. Identity `economictimes-<articleId>` (numeric id from the URL tail).
  - `LiveMintAdapter` (`livemint.ts`) — scrapes the `/industry/agriculture` listing (`<slug>-<id>.html` anchors, section-path filtered) and fetches each story for NewsArticle ld+json + `div.storyParagraph > p` paragraphs. Identity `livemint-<numericId>`. No server-side pagination (client-side infinite scroll) — collects page 1 only.
  - `AgricultureDiveAdapter` (`agriculturedive.ts`) — scrapes `/topic/<topic>/` listings (`/news/<slug>/<id>/` anchors, `?page=N` pagination) and fetches each story for `div.article-body` paragraphs + NewsArticle ld+json. Identity `agriculturedive-<id>`. One `SyncSource` serves both seeded categories: `crops` and `dairy`.
  - `TheHinduAdapter` (`thehindu.ts`) — scrapes `/topic/Agriculture/` (`h3.title` anchors to `articleNNN.ece`, `?page=N`) and fetches each story for `div[itemprop="articleBody"]` + `og:`/`article:published_time` meta (no ld+json). Identity `thehindu-<articleId>`.
- `agriculture.com/news` was probed and rejected: the whole domain (including sitemaps) sits behind a PerimeterX/HUMAN JS challenge that plain `fetch` cannot pass — it would need a headless browser to scrape.
- Added three generic adapters so most new sites are config-only onboardings (`adapterConfig` on `SyncSourceCategory`, no new code):
  - `WordPressAdapter` (`wordpress.ts`) — for any site exposing `/wp-json/wp/v2/posts`. Config: `wpCategoryId` (required), `contentLocale`, `perPage`. Passes `_embed=1` for featured media, stops on empty/out-of-range pages, and mirrors `contentLocale` text into `en-IN` when the site publishes no English. `ChiniMandiAdapter` now subclasses it (keeps `chinimandi-<id>` identities). Verified live on emandirates.com (3 Hindi categories), krishakjagat.org, millingandmillers.com, agribusinessglobal.com, farmersreviewafrica.com, fertiliserindia.com.
  - `RssAdapter` (`rss.ts`) — for any RSS 2.0 feed: auto-discovers `<link rel="alternate" type="application/rss+xml">` from the listing page or takes `adapterConfig.feedUrl`. Handles CDATA, `content:encoded` (used as-is when full), enclosures, `guid`/`link`/`pubDate`, and falls back to fetching each article (`parseRssArticle`: NewsArticle ld+json → `articleBody` → `og:` meta → common body containers, plus a raw `"articleBody":"…"` regex for malformed JSON-LD like Moneycontrol's). `--after` short-circuits on feed order. Verified on dairynews7x7.com (full `content:encoded`) and ssricenews.com (summary feed + Joomla `div.fulltext` article fetch).
  - `GenericHtmlAdapter` (`generic-html.ts`) — for plain HTML listing sites. Config: `articleUrlPattern` (regex tested against each anchor's `URL.pathname`, required), `bodyMarker`, `excludeUrlPattern`, `pageParam`, `contentLocale`. Merges image-only + titled anchor halves of listing cards, resolves relative URLs, sends a browser-like User-Agent by default (`withUserAgent`), and treats tiny 200-status "403 Forbidden"/challenge bodies as blocks (`looksLikeChallenge`) instead of silently ingesting zero items. Verified on africancashewalliance.com, agrowon.esakal.com (Marathi), apk-inform.com, bizzbuzz.news, business-standard.com, deccanherald.com, fwi.co.uk, kisantak.in, mundus-agri.eu, ndtv.com, outlookindia.com, timesofindia.indiatimes.com, fertilizerdaily.com, tribuneindia.com, moneycontrol.com.
- Added `mr-IN` to `SUPPORTED_LOCALES` (`packages/shared/src/constants/locales.ts`) for Marathi sources; `packages/shared/src/i18n/resources` now falls back to English for locales without a UI dictionary so API responses stay valid.
- User's 47-URL sweep outcome: 28 URLs fully syncing (10 pre-existing, 8 WordPress, 2 RSS + FIF, 8+ generic-html incl. the two extra BusinessLine `/topic/` categories on the existing adapter). Probed and rejected: `agriland.ie`, `commodityonline.com`, `graincentral.com`, `marketscreener.com` (JS shell), `seafoodsource.com` ×2, `croplife.com`, `agriculture.com` — all Cloudflare/PerimeterX-challenged; `world-grain.com` serves its listing but challenges article pages; `news.agropages.com` intermittently serves fake-200 403 bodies (rate-limit windows — retry works); `informistmedia.com` is paywalled (no public article links). Dead/moved URLs: `smctradeonline.com/news/commodity` 404, `tribuneindia.com/news/tag/agriculture` → `/topic/agriculture` (seeded), `newsonair.com` dead (newsonair.gov.in is WP but has no agriculture category).
- WhatsApp integration remains intentionally unimplemented until legal, credentials, rate-limit, and operational requirements are approved.
