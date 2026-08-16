# Plan 01 — Product scope and implementation contract

## Objective

Lock the v1 behavior so implementation agents do not invent incompatible models or screens.

## Product flow to implement first

The first demonstrable milestone is:

1. Docker PostgreSQL and LocalStack start.
2. Prisma migration creates the schema.
3. Ordered seed creates one published English `BlogPost`.
4. Admin signs in and sees the seeded post, including `createdAt`, source, and external URL.
5. Admin creates/edits/publishes another `BlogPost`.
6. Mobile signs in and receives the published post feed.
7. Mobile applies language/location/category filters and opens the external URL.

Music, video, automated crawling, and additional post types must not block this text-post vertical slice.

## Domain decisions

- Top-level entity: `Post`.
- First type: `PostType.BLOG_POST`.
- Type detail: one-to-one `BlogPost`.
- BlogPost fields: localized title/content, image/media reference, `externalRedirectUrl`, `source`, category/location relations, publication/lifecycle metadata.
- `source`: `WHATSAPP`, `WEBSITE`, `MANUAL`.
- Every model has `createdAt`; mutable models also have `updatedAt`; database timestamps are UTC.
- Daily-content rules use `Asia/Kolkata`.
- States: `DRAFT`, `PUBLISHED`, `ARCHIVED`, `REMOVED`; removal is soft deletion.
- English translation is required for a publishable post. Requested language falls back to English.
- Mobile feed filters: language, location, category.
- Mobile users self-register with email/password. Admin/editor access is role protected.
- Authentication uses bearer access tokens; refresh/revocation is server-managed.
- Admin UI is English in v1. Mobile UI uses namespaced locale JSON files, beginning with English and Hindi.
- Development uses Docker PostgreSQL and LocalStack S3; production uses managed PostgreSQL and AWS S3.

## Out of scope

Social login/OTP, comments, likes, follows, recommendations, search, payments, notifications, advanced editorial roles, automatic translation, transcoding, and WhatsApp API integration are not v1 blockers.

## Required decisions during implementation

Choose and record:

- Initial mobile locales, defaulting to `en-IN` and `hi-IN` if no further decision is supplied.
- Location hierarchy, defaulting to country/state/district if no further decision is supplied.
- Access-token and refresh-token expiry.
- Whether image URL is a public CDN URL or a media asset ID resolved by the API; prefer media asset IDs.

## Completion criteria

- Product behavior above is written into shared DTOs and tests.
- Any implementation-level defaults are recorded in the relevant plan and README.
