# Plan 00 — Git repository setup

## Objective

Create a safe, collaborative Git baseline for the monorepo. This plan is already complete in the current repository; future agents should not repeat initialization or force-push.

## Repository contract

- Remote: `git@github.com:ankurgahtori/VirtualMandi.git`
- Primary branch: `main`
- Project-local agent skill: `.agents/skills/virtual-mandi/SKILL.md`
- Plans: `plans/`

## Agent procedure

1. Run `git status --short --branch` and `git remote -v` before editing.
2. Never reset, rebase, delete branches, change remotes, or force-push without explicit instruction.
3. Keep each plan in a focused commit; do not commit generated build output, dependency folders, credentials, or databases.
4. Use descriptive commit messages such as `feat(api): add blog post feed`.
5. Push only the branch being worked on and report the commit hash.

## Required repository protection

Create or maintain `.gitignore` entries for `node_modules`, `.turbo`, build output, Expo/Next caches, Prisma generated artifacts when ignored by the chosen setup, `.env*` except safe templates, AWS credentials, Docker volumes, logs, IDE files, OS files, signing files, and database dumps.

Safe templates may be committed:

- `.env.example`
- `apps/api/.env.example`
- `apps/admin/.env.example`
- `apps/mobile/.env.example`

Templates must contain variable names and non-sensitive local placeholders only.

## Validation

```bash
git status --short --branch
git remote -v
git log --oneline -3
git diff --check
```

## Completion criteria

- Git history is preserved.
- The working tree is clean before handoff.
- The agent reports changed files, validation, commit hash, and push status.
