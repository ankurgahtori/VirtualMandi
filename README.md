# Virtual Mandi

Virtual Mandi is a multilingual agricultural content platform with an Expo mobile app, an English admin dashboard, and a TypeScript API.

## Current status

Plans 02 (monorepo foundation), 03 (shared contracts), and 04 (Prisma data layer) are implemented. Start Docker Desktop and run `pnpm infra:up` to validate the PostgreSQL and LocalStack containers. If host port `5432` is occupied, use `POSTGRES_PORT=5433 docker compose up -d postgres localstack` and point `DATABASE_URL` at port `5433`. API, admin, and mobile features are intentionally not implemented yet.

## Prerequisites

- Node.js 22.12 or newer
- Corepack-enabled Node installation
- Docker Desktop with Compose v2

The repository pins pnpm in `package.json`; Corepack will provide it.

## Local setup

```bash
corepack enable
corepack install
pnpm install
cp .env.example .env.local
pnpm infra:up
docker compose ps
```

The local infrastructure exposes:

- PostgreSQL: `localhost:5432`
- LocalStack edge/S3 endpoint: `http://localhost:4566`
- LocalStack bucket: `virtual-mandi-local`

The database schema and seed commands become available in Plan 04. Do not run destructive infrastructure reset commands against production.

## Workspace commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm infra:up
pnpm infra:down
pnpm infra:reset
```

## Project rules

- Prisma Client is server-only and must never be imported by admin browser or mobile code.
- Never commit real environment values, AWS credentials, private keys, Docker volumes, or production data.
- Read the matching file in `plans/` and `.agents/skills/virtual-mandi/SKILL.md` before implementing a plan.
