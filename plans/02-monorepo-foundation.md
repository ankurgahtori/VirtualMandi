# Plan 01 — Monorepo foundation

## Goal

Create the root workspace engine so three applications and shared packages can be developed together.

## Scope

- Initialize the repository as a `pnpm` workspace.
- Add Turborepo task orchestration and root scripts for `dev`, `build`, `lint`, `typecheck`, `test`, and formatting.
- Create the intended directories:
  - `apps/api`
  - `apps/admin`
  - `apps/mobile`
  - `packages/shared`
  - `packages/database`
  - `packages/config-typescript`
  - `packages/config-eslint`
  - `prisma`
- Add TypeScript base configuration and package-specific extensions.
- Add consistent environment-file conventions and safe `.gitignore` rules.
- Add a root README explaining setup without committing secrets.
- Add a minimal CI workflow that installs, validates, and builds workspace packages that exist at this stage.

## Constraints

- Keep package names scoped and consistent, for example `@virtual-mandi/shared` and `@virtual-mandi/database`.
- Avoid adding app-specific domain types to the root config package.
- Do not initialize generated Prisma output yet; that belongs to Plan 03.
- Do not commit real `.env` values.

## Validation

- `pnpm install --frozen-lockfile` after the lockfile exists.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- Confirm Turborepo respects package dependency order.

## Definition of done

- A clean checkout can install dependencies and run the root validation scripts.
- All three app directories and shared package boundaries exist.
- A later agent can work on one app without changing the workspace architecture.
