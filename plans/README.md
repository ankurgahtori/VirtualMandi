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
- **Content:** text, text with background music, and video; draft, published, archived, and soft-removed states
- **Feed filters:** language, location, and category
- **Localization:** each content item can have multiple language versions with English fallback; mobile static strings use namespaced `en.json`, `hi.json`, and future locale files
- **Media:** AWS S3 in deployed environments, with a local filesystem/MinIO-compatible adapter for development and tests
- **Seeds:** ordered, idempotent seed modules such as `user.seed.ts`, `category.seed.ts`, and `content.seed.ts`, executed through one deterministic seed runner after migrations

> Prisma Client must never be bundled into React Native or browser code. Clients consume shared DTOs and validation/types; only server-side API code imports the database package.

## Sequence

| Order | Plan | Depends on | Scope |
|---:|---|---|---|
| 0 | [Git repository setup](./00-git-repository-setup.md) | None | Initialize Git, ignore secrets, commit and push planning baseline |
| 1 | [Product scope and decisions](./01-product-scope-and-decisions.md) | 0 | Confirm v1 behavior and domain boundaries |
| 2 | [Monorepo foundation](./02-monorepo-foundation.md) | 1 | Workspace engine, app/package layout, scripts, quality tooling |
| 3 | [Shared contracts and utilities](./03-shared-contracts-and-utilities.md) | 2 | DTOs, validation, translations, constants, API contracts |
| 4 | [Prisma data layer](./04-prisma-data-layer.md) | 2, 3 | Root schema, localization/filter models, migrations, ordered seeds |
| 5 | [Backend API](./05-backend-api.md) | 3, 4 | Self-registration, bearer auth, feed, content management, S3 boundary |
| 6 | [Mobile environment](./06-mobile-environment-setup.md) | 2 | Expo/native prerequisites and environment configuration |
| 7 | [Mobile application](./07-mobile-application-v1.md) | 3, 5, 6 | Multilingual Inshorts-style feed and media playback |
| 8 | [Admin website](./08-admin-website-v1.md) | 3, 5 | English content dashboard and multilingual authoring |
| 9 | [Integration and release hardening](./09-integration-quality-and-release.md) | 4–8 | E2E checks, CI, observability, deployment readiness |

## Working agreement for each plan

1. Read the plan and `.agents/skills/virtual-mandi/SKILL.md`.
2. Inspect existing work; preserve unrelated changes.
3. Implement only the selected plan.
4. Run that plan's validation commands.
5. Update its checklist/notes and record assumptions before handoff.
