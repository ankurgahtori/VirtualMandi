# Plan 02 — Monorepo foundation

## Status

Implemented in the repository. Static workspace and Compose validation pass; runtime container validation is pending Docker Desktop being started on the developer machine.

## Objective

Create the workspace and local infrastructure required by every later plan.

## Expected repository layout

```text
apps/
  api/                 # Fastify Node server
  admin/               # Next.js browser dashboard
  mobile/              # Expo React Native app
packages/
  shared/              # DTOs, schemas, constants, translations
  database/            # Prisma client; server-only
  config-typescript/   # shared tsconfig bases
  config-eslint/       # shared lint configuration
prisma/schema.prisma
infra/docker-compose.yml or docker-compose.yml
scripts/
```

## Implementation steps

1. Add `package.json` with package manager metadata and root scripts.
2. Add `pnpm-workspace.yaml` covering `apps/*` and `packages/*`.
3. Add `turbo.json` tasks with dependency-aware `build`, `dev`, `lint`, `typecheck`, `test`, and `format` pipelines.
4. Create minimal package manifests for shared/config packages. Do not create application features yet.
5. Configure TypeScript strict mode, module resolution, path/export conventions, and no accidental Prisma imports from client packages.
6. Configure ESLint/Prettier and root scripts.
7. Add Docker Compose with two services:
   - `postgres`: official PostgreSQL image, health check, named volume, database/user/password from local env defaults.
   - `localstack`: LocalStack image, S3 enabled, health check, named volume if needed, initialization hook/script to create the development bucket.
8. Add `infra/localstack/init/ready.d/` or the selected LocalStack initialization path. The script must be idempotent and create the configured bucket.
9. Add root `.env.example` documenting `DATABASE_URL`, `AWS_REGION`, `S3_BUCKET`, `S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` local placeholders.
10. Add README setup commands and a troubleshooting section for Docker networking, Expo host access, and port conflicts.
11. Add CI skeleton that can run after packages exist.

## Required scripts

Provide stable names, even if implemented through `pnpm`:

```text
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm infra:up
pnpm infra:down
pnpm infra:reset
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

`infra:reset` may delete local Docker volumes only after an explicit confirmation/documented command. Never point reset scripts at production.

## Environment rules

Maintain separate templates and loading conventions for `local`, `test`, `staging`, and `production`. Do not create one committed `prod.env` containing secrets. Use deployment secret stores for production and document variable names consistently across API/admin/mobile.

## Validation

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
docker compose config
pnpm infra:up
docker compose ps
```

Both services must report healthy. A second `pnpm infra:up` must be safe.

## Completion criteria

- Fresh checkout can install and start infrastructure.
- Workspace dependency ordering works.
- No app imports Prisma because Prisma is not implemented yet.
- README allows a new developer to reach healthy Docker services without guessing.
