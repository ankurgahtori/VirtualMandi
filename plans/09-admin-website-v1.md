# Plan 09 — Admin website v1

## Goal

Deliver a protected browser dashboard for managing typed agricultural posts, beginning with BlogPost.

## Scope

- Bootstrap `apps/admin` as a Next.js TypeScript application.
- Implement email/password login and protected server/client routes according to the API session design.
- Add post list with filters for type, draft, published, archived, removed, source, language, location, and category.
- Add BlogPost create/edit form with title, image/media, content, external redirection URL, and source (`WHATSAPP`, `WEBSITE`, `MANUAL`).
- Allow editors to author the same BlogPost in multiple languages, require English as the fallback version, and clearly show missing translations.
- Show `createdAt`, source, external URL, post type, lifecycle state, and crawler provenance where available in the admin UI.
- Add media upload/storage integration through the API's S3/local-media boundary; do not put AWS or storage secrets in the browser.
- Add preview of each content kind before publishing.
- Add explicit confirmation for publish, archive, restore, and remove actions.
- Show validation, upload, authorization, and network errors clearly.
- Add responsive layout and basic accessibility.
- Add tests for route protection, BlogPost form validation, source/URL display, lifecycle actions, and API error handling.

## Constraints

- Browser code consumes shared DTOs and API contracts only.
- Keep destructive behavior reversible in v1 through soft deletion.
- Do not build advanced editorial roles unless approved in Plan 01/04.

## Validation

- Admin unit/component tests.
- `pnpm --filter @virtual-mandi/admin typecheck`
- Browser smoke test covering login, view seeded BlogPost, create draft, edit source/URL, publish, archive, restore, and remove.
- Verify production build does not contain server secrets or Prisma code.

## Definition of done

- An authorized editor can manage the complete v1 content lifecycle from the website.
- A non-authenticated visitor cannot access protected pages or mutate content.
