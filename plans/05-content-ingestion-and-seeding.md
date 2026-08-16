# Plan 05 — Content ingestion, crawling, and seeded posts

## Goal

Create a safe ingestion path for crawler output and deterministic development seed data, producing the first working `BlogPost` records without allowing crawled content to bypass validation or editorial controls.

## Domain model for this plan

- `Post` is the top-level content entity.
- `Post.type` is an enum, initially `BLOG_POST`; future types can be added without changing the feed contract.
- `BlogPost` is the type-specific one-to-one detail entity for a `Post`.
- Every model has `createdAt`; mutable models also have `updatedAt`. Persist timestamps in UTC and apply IST at presentation/daily-boundary logic.
- `BlogPost` supports:
  - `title`
  - `image`/media reference
  - `content`
  - `externalRedirectUrl`
  - `source`: `WHATSAPP`, `WEBSITE`, or `MANUAL`
- Keep the model ready for multilingual content. Language-specific title/content should use translation records or an equivalent normalized structure, with English required as fallback. Image, redirect URL, and source may be shared when they are not language-specific.
- Store crawler provenance separately where useful, such as source URL, fetched time, crawler name/version, and a stable external identifier. Do not silently overwrite an existing post when the same source item is seen again.

## Scope

- Define a normalized crawler input contract that is independent of any specific website or WhatsApp integration.
- Add a server-only ingestion service that validates, normalizes, deduplicates, and persists input using the database package.
- Add source adapters/interfaces for website and WhatsApp inputs, while keeping actual crawling/scraping providers replaceable and compliant with source terms and applicable law.
- Add deterministic seed modules in foreign-key order:
  1. users/admin account
  2. languages/locales
  3. locations
  4. categories
  5. media fixtures or LocalStack S3 objects
  6. posts
  7. blog-post details/translations
  8. optional publish state and filter relations
- Include at least one seeded English `BLOG_POST` with title, image, content, external redirect URL, source, category, location, and published state so the admin list and mobile feed have usable data.
- Make seed modules idempotent using stable keys/upserts and make their order explicit in one seed runner.
- Keep crawler-ingested posts as drafts by default unless an explicit trusted workflow opts into publishing.
- Record ingestion failures in a structured result/report; one malformed item must not corrupt the whole seed run without a clear transaction policy.

## Validation

- Run migrations against Docker PostgreSQL.
- Initialize a test image/object in LocalStack S3 when image storage is exercised.
- Run the full seed command twice and verify stable record counts, no FK failures, and no duplicate posts.
- Verify the seeded post appears in the admin query and published mobile feed query.
- Test duplicate detection for the same source/external identifier and invalid URL/content inputs.
- Unit-test normalization independently from crawler adapters.

## Definition of done

- A new developer can start Docker services, migrate, run the seed command, and see a usable seeded blog post.
- Crawler output has a validated, repeatable path into `Post`/`BlogPost` without direct Prisma access from crawler adapters.
- Seeded content is visible through later API/admin/mobile plans while preserving English fallback and feed filters.
