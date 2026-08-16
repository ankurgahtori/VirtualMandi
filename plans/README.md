# Virtual Mandi implementation plans

These plans are ordered for one-at-a-time implementation by separate agents. Complete and validate each plan before starting the next one.

## Confirmed architecture and product decisions

- **Monorepo:** `pnpm` workspaces + Turborepo
- **Applications:** `apps/api`, `apps/admin`, `apps/mobile`
- **API:** Node.js + TypeScript + Fastify
- **Admin website:** Next.js + TypeScript, English UI for v1
- **Mobile:** Expo React Native + TypeScript, multilingual UI
- **Database:** PostgreSQL + Prisma
- **Shared code:** `packages/shared` for domain types, DTOs, validation schemas, constants, translations, and platform-neutral utilities
- **Database package:** `packages/database` owns Prisma access and generated server-side client
- **Authentication:** email/password with self-registration and bearer access tokens; token refresh/revocation is handled by the API
- **Timezone:** Asia/Kolkata / IST for daily-content rules and date presentation defaults
- **Content model:** top-level `Post` with a `type` field; v1 implements `BLOG_POST` through a one-to-one `BlogPost` detail entity
- **BlogPost fields:** title, image/media reference, createdAt, content, external redirection URL, and source (`WHATSAPP`, `WEBSITE`, `MANUAL`), with multilingual title/content and English fallback
- **Content lifecycle:** draft, published, archived, and soft-removed states
- **Feed filters:** language, location, and category
- **Localization:** each post can have multiple language versions with English fallback; mobile static strings use namespaced `en.json`, `hi.json`, and future locale files
- **Development infrastructure:** Docker Compose with PostgreSQL and LocalStack containers
- **Media:** AWS S3 in deployed environments, with LocalStack S3 for development and tests
- **Ingestion:** validated crawler adapters normalize website/WhatsApp/manual input; crawler-ingested content defaults to draft
- **Seeds:** ordered, idempotent seed modules including an initial seeded `BLOG_POST`, executed through one deterministic runner after migrations

> Prisma Client must never be bundled into React Native or browser code. Clients consume shared DTOs and validation/types; only server-side code imports the database package.

## Sequence

| Order | Plan | Depends on | Scope |
|---:|---|---|---|
| 0 | [Git repository setup](./00-git-repository-setup.md) | None | Initialize Git, ignore secrets, commit and push planning baseline |
| 1 | [Product scope and decisions](./01-product-scope-and-decisions.md) | 0 | Confirm v1 behavior and domain boundaries |
| 2 | [Monorepo foundation](./02-monorepo-foundation.md) | 1 | Workspace engine, Docker development infrastructure, app/package layout, scripts, quality tooling |
| 3 | [Shared contracts and utilities](./03-shared-contracts-and-utilities.md) | 2 | DTOs, post types, validation, translations, constants, API contracts |
| 4 | [Prisma data layer](./04-prisma-data-layer.md) | 2, 3 | Root schema, Post/BlogPost models, localization/filter models, migrations |
| 5 | [Content ingestion and seeding](./05-content-ingestion-and-seeding.md) | 3, 4 | Crawler normalization, LocalStack fixtures, ordered seeds, seeded BlogPost |
| 6 | [Backend API](./06-backend-api.md) | 3–5 | Self-registration, bearer auth, feed, post management, S3 boundary |
| 7 | [Mobile environment](./07-mobile-environment-setup.md) | 2 | Expo/native prerequisites and environment configuration |
| 8 | [Mobile application](./08-mobile-application-v1.md) | 3, 6, 7 | Multilingual Inshorts-style feed and media playback |
| 9 | [Admin website](./09-admin-website-v1.md) | 3, 5, 6 | English dashboard, BlogPost management, multilingual authoring, source visibility |
| 10 | [Integration and release hardening](./10-integration-quality-and-release.md) | 4–9 | E2E checks, CI, observability, deployment readiness |

## Recommended working path to a usable product

Build the first vertical slice rather than completing isolated infrastructure indefinitely:

1. Complete Plans 00–05 and confirm `docker compose up`, migrations, seed, and one seeded post.
2. Implement only the API needed for registration/login, published BlogPost feed, and admin BlogPost CRUD/lifecycle actions.
3. Implement the admin website against those endpoints so an editor can view the seeded post and create/update/publish another one.
4. Implement the mobile app against the same published feed, including locale and filter selection.
5. Add media playback and broader crawler adapters after text BlogPost end-to-end flow works.
6. Run the integration plan only after admin-to-API-to-mobile flow works locally.

## Working agreement for each plan

1. Read the plan and `.agents/skills/virtual-mandi/SKILL.md`.
2. Inspect existing work; preserve unrelated changes.
3. Implement only the selected plan.
4. Run that plan's validation commands.
5. Update its checklist/notes and record assumptions before handoff.
