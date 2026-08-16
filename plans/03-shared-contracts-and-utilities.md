# Plan 03 — Shared contracts and utilities

## Status

Implemented. The shared package now exports typed post/auth/feed/ingestion contracts, runtime schemas, locale resources, IST date helpers, and tests.

## Objective

Define the stable contracts consumed by API, admin, and mobile before those clients are implemented.

## Files to create

Under `packages/shared/src/`:

```text
constants/post.ts
constants/locales.ts
constants/lifecycle.ts
schemas/auth.ts
schemas/post.ts
schemas/ingestion.ts
schemas/feed.ts
dtos/auth.ts
dtos/post.ts
dtos/feed.ts
dtos/errors.ts
i18n/en.json
i18n/hi.json
i18n/index.ts
dates/ist.ts
media/types.ts
index.ts
```

Exact filenames may vary, but exports must remain explicit from `src/index.ts`.

## Domain contracts

Define enums/constants:

- `PostType`: `BLOG_POST`
- `PostStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`, `REMOVED`
- `PostSource`: `WHATSAPP`, `WEBSITE`, `MANUAL`
- Locale identifiers and fallback locale (`en-IN`/`en`, then `hi-IN`/`hi` as selected)

Define discriminated DTOs:

```ts
type PostSummary = {
  id: string;
  type: PostType;
  status: PostStatus;
  createdAt: string;
  publishedAt?: string;
  categoryId?: string;
  locationIds: string[];
};

type BlogPostDetail = PostSummary & {
  type: 'BLOG_POST';
  title: string;
  content: string;
  image?: MediaDto;
  externalRedirectUrl?: string;
  source: PostSource;
  requestedLocale: string;
  resolvedLocale: string;
  isEnglishFallback: boolean;
};
```

Use ISO strings at HTTP boundaries. Keep database records and Prisma types out of this package.

## Validation rules

- Title and content are required for each translation.
- English translation is required before publishing.
- `externalRedirectUrl`, when present, must be an absolute `http`/`https` URL.
- `source` must be the enum value.
- Feed filters validate locale, category, location, cursor, and page size.
- Ingestion input rejects missing stable identity/source/content and returns structured field errors.

## Localization

- Static mobile strings live in locale JSON files with namespaces such as `common`, `auth`, `feed`, `filters`, and `post`.
- Provide `getMessage(locale, key)` with requested-locale → configured fallback → English lookup.
- Missing translations must be detectable in tests; do not silently return the key in production without a fallback.

## Tests

Test schemas, discriminated post parsing, English publish requirement, URL safety, source enum, cursor validation, locale fallback, date serialization, and ingestion normalization inputs.

## Completion criteria

- API, admin, and mobile can import shared contracts.
- All public exports are documented in package README.
- No Node, Prisma, DOM, React, Expo, filesystem, or secret dependency enters the package.
- Later agents do not define duplicate post/auth/filter types.
