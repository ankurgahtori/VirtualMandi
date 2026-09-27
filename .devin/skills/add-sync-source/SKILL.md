---
name: add-sync-source
description: Add a new sync source or sync source category (listing URL) to Virtual Mandi without writing code — create SyncSource/SyncSourceCategory rows via the admin /sync page, API, or seed, then trigger and verify a sync. Invoke whenever the user wants to start scraping a new listing URL on a supported site; for a brand-new site with no adapter, use the add-scraper-source skill instead.
argument-hint: '<listing URL or domain to sync>'
allowed-tools:
  - exec
  - read
  - edit
  - grep
  - glob
---

# Add a sync source / category

Sync targets live in the database, not code: `SyncSource` (one per domain, `adapterKey` → registered adapter) and `SyncSourceCategory` (listing URL + feed `Category`/`Location` mapping + optional `adapterConfig`). Synced posts are stamped with `Post.syncSourceId`/`syncSourceCategoryId`, which drives the admin `/sync` page stats.

## Step 0 — does an adapter cover this domain?

Check `INGESTION_ADAPTERS` in `packages/ingestion/src/sources.ts` and existing sources:

```bash
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi -c \
"SELECT domain, \"adapterKey\" FROM \"SyncSource\";"
```

- **Domain already has a SyncSource** → skip to step 2; only a new `SyncSourceCategory` is needed.
- **New domain, no registered adapter** → stop and use the `add-scraper-source` skill (writes the adapter, registers `adapterKey`, then creates these rows). A DB row alone cannot scrape unknown markup.
- **New domain, registered adapter fits** (e.g. another WordPress site on the `chinimandi` adapter) → step 1.

## Step 1 — create the SyncSource (new domains only)

Admin `/sync` page → "Add sync source" (domain, label, adapter select), or the API:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@virtualmandi.local","password":"<admin password>"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["tokens"]["accessToken"])')

curl -X POST http://localhost:3000/v1/admin/sync/sources \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"domain":"<hostname>","label":"<label>","adapterKey":"<adapterKey>"}'
```

`domain` must equal `new URL(canonicalUrl).hostname` for the site's article URLs — attribution and `LISTING_DOMAIN_MISMATCH` validation depend on it.

## Step 2 — create the SyncSourceCategory

Admin `/sync` page → "Add category" (source, label, listing URL, feed category, location, optional adapter config JSON), or:

```bash
curl -X POST http://localhost:3000/v1/admin/sync/categories \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"syncSourceId":"<id>","label":"<label>","listingUrl":"<listing URL>","categoryId":"<feed Category id>","locationId":"<Location id>"}'
```

- `listingUrl` — the listing/section page the adapter walks (e.g. `https://krishijagran.com/industry-news`). Its hostname must match the source domain.
- `categoryId`/`locationId` — feed rows that auto-tag every synced post (pick from `feedCategories`/`locations` in `GET /v1/admin/sync/sources`). Leave unset to keep adapter defaults.
- `adapterConfig` — escape hatch for params a URL can't express. `chinimandi` uses `{"categoryId": <WP id>}`; find it via `GET /wp-json/wp/v2/categories?search=<name>`.
- Errors: `LISTING_DOMAIN_MISMATCH` (URL host ≠ domain), `SYNC_CATEGORY_EXISTS`, `UNKNOWN_ADAPTER`.

For seed-managed sources, add rows in `packages/database/src/seed/sync-source.seed.ts` instead (idempotent upserts) and run `pnpm db:seed`.

## Step 3 — sync + verify

Trigger from the `/sync` page or:

```bash
curl -X POST http://localhost:3000/v1/admin/sync/categories/<id>/sync \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"pages":1}'   # optional: pages (≤10), after (ISO), update (bool)
```

Expected: `{accepted, created, duplicate, rejected, errors}` then verify attribution:

```bash
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi -c \
"SELECT count(*) FROM \"Post\" WHERE \"syncSourceCategoryId\"='<id>';"
```

Re-run → `created: 0`, `duplicate` > 0. `lastSyncedAt` and `postCount` update on the sync page.

## Report to the user

Rows created (source/category ids), sync result counts, post count under the new category, and dedup behavior on re-run. If the first sync collects nothing, check whether the adapter's listing parser accepts the URL's link shape (e.g. krishijagran anchors are relative `/<category>/<slug>`).
