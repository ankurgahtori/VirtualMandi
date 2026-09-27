---
name: add-scraper-source
description: Add a new website scraping source to Virtual Mandi end-to-end — probe the site, write a WebsiteIngestionAdapter in packages/ingestion, register its adapterKey in sources.ts, create the SyncSource/SyncSourceCategory rows, add CLI + scripts + tests, and verify a live ingest. Invoke whenever the user asks to scrape/crawl/sync a website with no registered adapter; if the site is already supported, use the add-sync-source skill instead.
argument-hint: '<site URL or listing URL to scrape>'
allowed-tools:
  - exec
  - read
  - write
  - edit
  - grep
  - glob
  - webfetch
---

# Add a new scraping source

Virtual Mandi ingests external news sites as `Post`/`BlogPost` rows through website adapters in `packages/ingestion`. **Most new sites need no new code** — three generic adapters cover the common mechanisms:

| Mechanism                                   | Adapter key    | `adapterConfig`                                                                                                          |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| WordPress REST API (`/wp-json/wp/v2/posts`) | `wordpress`    | `wpCategoryId` (required), `contentLocale`, `perPage`                                                                    |
| RSS feed (auto-discovered or explicit)      | `rss`          | `feedUrl`, `fetchArticles`, `maxItems`                                                                                   |
| HTML listing + article pages                | `generic-html` | `articleUrlPattern` (required, regex on `URL.pathname`), `bodyMarker`, `excludeUrlPattern`, `pageParam`, `contentLocale` |

Write a custom `WebsiteIngestionAdapter` only when none of these fit (e.g. krishijagran's hidden `/api/MoreStories` pagination). Reference implementations: `chinimandi.ts` (WP, now a `WordPressAdapter` subclass), `krishijagran.ts` (HTML + JSON pagination), `economictimes.ts` (RSS + article fetch).

Everything downstream is registry-driven: once the adapter exists and is registered, the admin `/sync` page, the `POST /v1/admin/sync/categories/:id/sync` API, dedup, and image re-hosting all work with zero additional code. Sites/listings are configured in the database: a `SyncSource` row per domain (`adapterKey` → adapter) and `SyncSourceCategory` rows per listing URL. Adding a new listing URL on an already-supported site needs no code — just a new category row from the admin `/sync` page.

## Step 1 — probe the site (cheap → expensive order)

1. **Bot-blocked?** First check `curl -s -o /dev/null -w "%{http_code}" <listing-url>` — a 403 or a JS-challenge page (PerimeterX/HUMAN, Cloudflare, "Simple Page" stubs) means plain `fetch` won't work; check `robots.txt`/`sitemap.xml` too. **Also check article pages, not just the listing** — world-grain.com serves listings but challenges articles. **Beware fake-200 blocks**: some WAFs return `200 OK` with a tiny `403 Forbidden` body (news.agropages.com) or intermittent challenges — retry with a browser UA (`generic-html` sends one by default) and report rate-limit-sensitive sites rather than treating 0-item runs as success. Report blocked sites rather than writing an adapter that can't run.
2. **WordPress?** `curl -s -o /dev/null -w "%{http_code}" "https://<host>/wp-json/wp/v2/posts?per_page=1"`. If 200 JSON → use the `wordpress` adapterKey with `adapterConfig.wpCategoryId` from `/wp-json/wp/v2/categories?search=<name>` — done, no code.
3. **RSS/feed?** Check for `<link rel="alternate" type="application/rss+xml">` or `/feed`. If items carry `content:encoded` use the `rss` adapterKey feed-only; summary-only feeds still work (the adapter fetches each article via `parseRssArticle` heuristics — NewsArticle ld+json → `articleBody` → `og:` meta → common containers, with a raw `"articleBody":"…"` regex fallback for malformed JSON-LD). An empty or site-wide feed means the RSS path is wrong for that listing — fall back to `generic-html`.
4. **HTML scraping** — `curl -sL <listing-url>` and inspect card markup. If article links match a single pathname regex (e.g. `^/en/news/\d+$`) → use `generic-html` with `articleUrlPattern` + optional `bodyMarker` (a substring of the body div's class/id). Only write a custom adapter when links are too irregular or pagination is non-standard. **Listing anchors may be root-relative** (`/news/<slug>`) — patterns are tested against `URL.pathname`, so absolute and relative hrefs both work. Look for "load more" buttons and the JS behind them — sites often expose a JSON endpoint (`/api/...`) that is far more stable than HTML pagination.
5. **Article pages** — prefer structured data: `application/ld+json` `NewsArticle` blocks, `og:title`/`og:image`/`og:description`, `<article>` paragraphs. Check for ads/figures/related-links inside the body container to strip.
6. **Pagination** — confirm `?page=N` (or path pagination) actually returns different stories; some sites serve identical HTML and paginate client-side only (livemint.com — collect page 1 only).

Decide per source: listing-only (metadata) vs listing + per-article fetch (full `content`). Full content is preferred — the summarizer skill needs the body.

## Step 2 — write the adapter (only if no generic adapter fits)

Skip this step when `wordpress`, `rss`, or `generic-html` covers the site — go straight to Step 3's DB rows. Otherwise create `packages/ingestion/src/<name>.ts` implementing `WebsiteIngestionAdapter` from `./adapters.js`. Requirements:

- `collect()` is an `AsyncGenerator` yielding raw items — the service normalizes each via `normalizeBlogPostInput`, so emit `AdapterInput` shapes, never Prisma types.
- **Stable identity**: `sourceItemId` must be `<name>-<stable id or url slug>` and `canonicalUrl`/`externalRedirectUrl` the absolute article URL — dedup relies on `ingestionSource + ingestionItemId` then `ingestionSource + canonicalUrl`.
- **en-IN translation is mandatory** (`normalize.ts` rejects otherwise). Non-English sources set `contentLocale` (`hi-IN`, `mr-IN`, … — the generic adapters mirror that text into `en-IN` automatically); a custom adapter must do the mirror itself like ChiniMandi does. New locales must be added to `SUPPORTED_LOCALES` in `packages/shared/src/constants/locales.ts` (the i18n map falls back to English).
- `categoryKeys`/`locationKeys` must exist in the DB seeds (`packages/database/src/seed/category.seed.ts`, `location.seed.ts` — today: `market-prices`, `news`, `india`). Pick sensibly or let callers override via options.
- Options shape mirrors the existing adapters: `baseUrl`, `maxPages`, `delayMs` (default 1000), `after` (ISO lower bound — stop collecting when a date-ordered feed drops below it), `categoryKeys`, `locationKeys`, `initialStatus` (default `DRAFT`), `fetchImpl`, `now` — always inject `fetchImpl`/`now` so tests need no network.
- Be polite and resilient: `delayMs` between requests, per-item failures `console.warn` + skip (don't kill the whole run), stop cleanly on empty/short pages or out-of-range responses.
- Reuse helpers from `./html.js` (`stripTags`, `readAttr`, `readMeta`, `findLdJson`, `paragraphsIn`, `extractDivByMarker`, `sleep`) and `decodeHtmlEntities` from `./chinimandi.js` for HTML text.
- When deduping listing anchors, check the anchor's title/content _before_ inserting into the `seen` set — cards often have an image-only anchor followed by a text anchor for the same URL.

## Step 3 — register the adapter key

Add an entry to `INGESTION_ADAPTERS` in `packages/ingestion/src/sources.ts`:

```ts
{
  key: '<adapter key stored on SyncSource.adapterKey>',   // e.g. 'chinimandi'
  label: '<Human label — shown in the admin adapter select>',
  createAdapter: (options) =>
    new XAdapter({
      baseUrl: options?.listingUrl ? new URL(options.listingUrl).origin : undefined,
      // translate options.listingUrl / options.adapterConfig into adapter options
      after: options?.after,
      maxPages: options?.maxPages,
      categoryKeys: options?.categoryKeys,
      locationKeys: options?.locationKeys,
      initialStatus: options?.initialStatus ?? 'PUBLISHED',
    }),
},
```

`listingUrl` is the per-category listing page URL from `SyncSourceCategory`; `adapterConfig` is a JSON escape hatch for parameters a URL can't express (e.g. a WordPress `categoryId`). Then create the rows — via the admin `/sync` page forms, or in `packages/database/src/seed/sync-source.seed.ts` for seed-able sources:

- `SyncSource { domain, label, adapterKey }` — `domain` must equal `new URL(canonicalUrl).hostname` so attribution resolves.
- `SyncSourceCategory { syncSourceId, label, listingUrl, categoryId?, locationId?, adapterConfig? }` — `categoryId`/`locationId` point at the feed `Category`/`Location` rows and auto-tag every synced post.

Posts are linked back through `Post.syncSourceId`/`syncSourceCategoryId` — set explicitly by admin syncs and by `sync-cli` (it resolves the `SyncSourceCategory` row from the exact `--listing-url`, which is required for sites whose article URLs live outside the listing path, e.g. agriculturedive.com's `/news/…` or thehindu.com's `articleNNN.ece`). Plain `ingestBlogPosts` calls still fall back to `canonicalUrl` hostname + longest listing-path prefix.

## Step 4 — CLI

No per-source CLI needed: `packages/ingestion/src/sync-cli.ts` is registry-driven — any registered `adapterKey` works:

```bash
cd packages/ingestion
npx tsx src/sync-cli.ts --adapter-key <key> --listing-url <url> \
  [--config '<json>'] [--after <iso>] [--pages <n>] [--delay-ms <n>] [--update] [--draft]
```

It ingests as PUBLISHED by default (pass `--draft` for a dry-ish run), re-hosts images via `createRemoteImageResolver()`, and attributes posts to the `SyncSourceCategory` row matching `--listing-url` (pass `--update` to backfill attribution on existing posts). `packages/ingestion/src/index.ts` → export the new module.

## Step 5 — tests

`packages/ingestion/test/<name>.test.ts` with `tsx --test` + `node:assert`, mirroring `chinimandi.test.ts`/`krishijagran.test.ts`: fixture HTML/JSON inline, inject a `fetchImpl` that routes by URL, assert mapped fields, pagination stop conditions, and the `after` cutoff. Run `pnpm --filter @virtual-mandi/ingestion test`.

## Step 6 — verify live

`docker compose up -d postgres localstack` (repo root; use `POSTGRES_PORT=5433` locally — `.env.local`'s `DATABASE_URL` points there), then run `sync-cli.ts` with the adapter key + listing URL. Expected output: `{accepted, created, duplicate, rejected, errors}`. Confirm rows in the DB:

```bash
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi -c \
"SELECT count(*) FROM \"Post\" WHERE \"crawlerName\"='<name>-<crawler>';"
```

Re-run once — `created` must be 0 / `duplicate` > 0 (idempotency proof). Posts should also carry `syncSourceId`/`syncSourceCategoryId` once the source rows exist (auto-resolved from `canonicalUrl`).

## Step 7 — document

Append an implementation note to `plans/05-content-ingestion-and-seeding.md` (source, mechanism, CLI usage, defaults) and commit with the repo's conventional style (`feat: add <name> adapter`).

## Checklist for the user

Report: mechanism chosen (WP API / JSON endpoint / HTML), files added/changed, post count ingested, dedup behavior on re-run, and the `SyncSource`/`SyncSourceCategory` rows created so the source appears on the admin `/sync` page.
