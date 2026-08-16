# Plan 07 — Admin website v1

## Goal

Deliver a protected browser dashboard for creating, publishing, archiving, restoring, and removing agricultural content.

## Scope

- Bootstrap `apps/admin` as a Next.js TypeScript application.
- Implement email/password login and protected server/client routes according to the API session design.
- Add content list with filters for draft, published, archived, and removed states.
- Add create/edit form for text, text with music, and video content.
- Allow editors to author the same story in multiple languages, require English as the fallback version, and clearly show missing translations.
- Add media upload/storage integration through the API's S3/local-media boundary; do not put AWS or storage secrets in the browser.
- Add preview of each content kind before publishing.
- Add explicit confirmation for publish, archive, restore, and remove actions.
- Show validation, upload, authorization, and network errors clearly.
- Add responsive layout and basic accessibility.
- Add tests for route protection, form validation, lifecycle actions, and API error handling.

## Constraints

- Browser code consumes shared DTOs and API contracts only.
- Keep destructive behavior reversible in v1 through soft deletion.
- Do not build advanced editorial roles unless approved in Plan 00/04.

## Validation

- Admin unit/component tests.
- `pnpm --filter @virtual-mandi/admin typecheck`
- Browser smoke test covering login, create draft, publish, archive, restore, and remove.
- Verify production build does not contain server secrets or Prisma code.

## Definition of done

- An authorized editor can manage the complete v1 content lifecycle from the website.
- A non-authenticated visitor cannot access protected pages or mutate content.
