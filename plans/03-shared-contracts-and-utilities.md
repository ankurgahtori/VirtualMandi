# Plan 03 — Shared contracts and utilities

## Goal

Create platform-neutral code that is authored once and consumed by the API, admin website, and mobile app.

## Scope

Implement `packages/shared` with:

- `PostType` and lifecycle/source enums/constants; v1 supports `BLOG_POST` with sources `WHATSAPP`, `WEBSITE`, and `MANUAL`.
- Supported locale, language, category, and location identifiers/conventions.
- Shared identifiers, `Asia/Kolkata` daily-boundary rules, and timestamp conventions.
- `Post` and `BlogPost` summary/detail DTOs for feed and admin use cases, including localized fields, English fallback metadata, source, image/media, and external redirection URL.
- Auth request/response DTOs.
- Runtime validation schemas for API boundaries (prefer an existing workspace dependency such as Zod).
- API error envelope and pagination/cursor types.
- Safe date/URL/media helpers that do not depend on Node, DOM, or React Native APIs.
- Mobile static-translation organization with namespaced locale resources such as `en.json` and `hi.json`, separated into common and page-level keys.
- Translation lookup/fallback utility: requested locale -> configured fallback -> English.
- Export maps that make public imports explicit.
- Add crawler input/output schemas for normalized BlogPost ingestion and seed data.
- Unit tests for schemas, serialization edge cases, locale fallback, filter validation, Post type discrimination, and source validation.

## Domain shape to support

The shared domain should expose a top-level `Post` with a discriminating `type`, beginning with `BLOG_POST`. Keep type-specific fields in the BlogPost DTO and leave room for future post types. A BlogPost includes localized title/content, image/media, external redirection URL, source, language/category/location fields, publication timestamps, and lifecycle metadata without exposing storage implementation details.

## Constraints

- Do not import Prisma, Fastify, Next.js, Expo, React, filesystem APIs, or secrets.
- Keep DTOs separate from database models; clients should not receive internal fields by accident.
- Treat all external input as untrusted and validate it at the boundary.

## Validation

- `pnpm --filter @virtual-mandi/shared test`
- `pnpm typecheck`
- Verify API, admin, and mobile packages can import the package without platform-specific compiler errors.

## Definition of done

- Shared exports are documented and stable enough for API/client implementation.
- Tests cover valid payloads, invalid payloads, optional media, and lifecycle transitions represented in DTOs.
