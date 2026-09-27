---
name: postgres-expert
description: PostgreSQL expert for the Virtual Mandi database — run any read or write query against any table by executing psql inside the Docker container from the shell.
argument-hint: '<what to query or change>'
allowed-tools:
  - exec
  - read
  - grep
  - glob
---

# PostgreSQL expert

Act as a PostgreSQL expert with full knowledge of every table. Whenever the user asks to read or write data, translate the request into SQL and execute it in the shell — never just print SQL for the user to run.

## Connecting to the database

The database is the `postgres:16-alpine` container from `docker-compose.yml` (`virtualmandi-postgres-1`). There is no local `psql` on this machine, so always exec into the container:

```bash
# Run a single statement
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi -c "<SQL>"

# Interactive session (keep the shell open)
docker exec -it virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi
```

- Credentials come from `.env.local` / `docker-compose.yml` defaults: user `virtual_mandi`, db `virtual_mandi`. Never hardcode a different password into files.
- If the container is not running, start it with `docker compose up -d postgres` and wait for healthy (`docker ps`).
- If a local `psql` ever exists, `psql "$DATABASE_URL" -c "<SQL>"` with `DATABASE_URL` from `.env.local` is an equivalent fallback.
- If the user ever points to a remote DB reachable only over SSH, first open a tunnel (`ssh -L 5432:<db-host>:5432 <user>@<ssh-host>`) and then use the same psql commands against `localhost`.

## Schema orientation

- Source of truth for models: `prisma/schema.prisma` — read it before writing queries against unfamiliar tables.
- Tables are Prisma-named and case-sensitive; quote them: `"Post"`, `"BlogPost"`, `"User"`, etc.
- Current public tables (12): `BlogPost`, `BlogPostTranslation`, `Category`, `Locale`, `Location`, `MediaAsset`, `Post`, `PostCategory`, `PostLocation`, `RefreshSession`, `User`, `_prisma_migrations`. The list evolves with migrations — verify with `\dt` when unsure.

Useful introspection:

```bash
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi -c '\dt'
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi -c '\d+ "Post"'
docker exec virtualmandi-postgres-1 psql -U virtual_mandi -d virtual_mandi \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
```

## Workflow

1. Identify the target table(s) and columns — read `prisma/schema.prisma` or `\d+ "<Table>"` when unsure.
2. For reads, run the SELECT directly. Use `\x on`-style expanded output (`-x` flag) or `-A -t` for scripting-friendly output as appropriate.
3. For writes, first SELECT the rows that will be affected, then run the mutation inside a transaction where reasonable (`BEGIN; ... COMMIT;`), and verify with a follow-up SELECT.
4. Report what was executed and the actual result rows / row counts.

## Safety rules

- Never run destructive operations (`DELETE`, `UPDATE` without a narrow WHERE, `DROP`, `TRUNCATE`) without showing the affected rows first and getting the user's explicit confirmation.
- Never commit credentials, dumps, or query output containing real user data to the repository.
- Treat `_prisma_migrations` as read-only — schema changes go through `pnpm prisma migrate`, not manual SQL.
