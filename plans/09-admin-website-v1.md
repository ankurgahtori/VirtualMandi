# Plan 09 — Admin website v1

## Objective

Build the English admin dashboard that proves the seeded BlogPost can be viewed and editorially managed.

## Routes

- `/login`
- `/posts`
- `/posts/new`
- `/posts/[id]/edit`
- optional `/posts/[id]/preview`

Protect all routes except login. Server-side and client-side API calls must use the API contract; browser code must not import Prisma or AWS credentials.

## BlogPost workflow

- List posts by type, status, source, language, category, location, and date.
- Display seeded post fields: title, image preview, `createdAt`, content excerpt, external URL, source, type, status, and translation completeness.
- Create/edit English BlogPost first, then add translation tabs/sections for supported locales.
- Require English title/content before publish.
- Validate image/media and external URL before submission.
- Show explicit actions and confirmation for publish, archive, restore, and soft-remove.
- Show crawler provenance and duplicate/source warnings when present.
- Use API-presigned media flow; never upload directly with long-lived AWS credentials.

## UI quality

Use responsive English UI, keyboard-accessible forms, clear server validation errors, unsaved-change warning, loading states, optimistic updates only when rollback is safe, and an error boundary.

## Tests

- Route protection and unauthenticated redirect.
- Form schemas and English publish requirement.
- Source/external URL/createdAt rendering.
- CRUD/lifecycle action success and failure.
- Seeded BlogPost browser smoke test.

## Completion criteria

An editor can log in, see the seeded BlogPost, create/edit/publish/archive/restore/remove a BlogPost, inspect source and external URL, and see missing translations without direct database access.
