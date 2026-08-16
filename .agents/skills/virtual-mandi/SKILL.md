---
name: virtual-mandi
description: Implement Virtual Mandi monorepo plans one at a time, preserving shared contracts and the server-only Prisma boundary across the API, admin website, and Expo mobile app.
---

# Virtual Mandi project skill

Use this skill for work in the Virtual Mandi repository. Read the relevant file under `plans/` before making changes.

## Workflow

1. Identify the requested plan and inspect the current repository state.
2. Implement only that plan's scope; do not jump ahead into later application features.
3. Preserve unrelated user changes and follow existing package conventions.
4. Reuse `@virtual-mandi/shared` for DTOs, validation schemas, constants, and platform-neutral utilities.
5. Keep `@virtual-mandi/database` and Prisma Client server-only. Never import Prisma into `apps/mobile` or browser code in `apps/admin`.
6. Validate with the commands listed in the plan, starting with the narrowest affected package.
7. Update the plan checklist or implementation notes when the repository has enough evidence to mark work complete.
8. Report files changed, validation run, and any unresolved product decisions.

## Architecture rules

- Applications live under `apps/`; reusable packages live under `packages/`.
- The Prisma schema lives at root `prisma/schema.prisma`.
- API responses use shared DTOs rather than leaking database records.
- Validate untrusted input at API and client form boundaries.
- Keep content removal reversible in v1 through soft deletion.
- Use `Asia/Kolkata` for daily-content rules unless a plan explicitly overrides it.
- Keep multilingual content translations separate from static mobile locale resources, and provide English fallback behavior.
- Preserve feed filters for language, location, and category across API and clients.
- Keep AWS S3 behind a media-storage interface with a local development/test adapter.
- Avoid committing secrets, real credentials, production data, or platform signing files.
- Prefer interfaces for external services such as media storage, analytics, and notifications.

## Product v1 boundary

The core experience is self-registration with email/password authentication, bearer-token sessions, an Inshorts-style agricultural feed filtered by language/location/category, and content management for multilingual text, text with music, and video. The admin website is English in v1; the mobile app has namespaced locale files with English fallback. Social features, recommendations, OTP/social login, and advanced editorial roles are out of scope unless a plan is explicitly updated.

## Handoff standard

A plan is complete only when its definition of done is met, its validation results are known, and any assumptions that affect the next plan are documented. Do not claim a command passed unless it was actually run.
