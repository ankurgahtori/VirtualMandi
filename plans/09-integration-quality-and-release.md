# Plan 08 — Integration, quality, and release hardening

## Goal

Make the first end-to-end slice dependable enough for staging and future independent agent work.

## Scope

- Add CI jobs for install, format check, lint, typecheck, unit tests, Prisma validation, and builds.
- Add a disposable PostgreSQL integration-test workflow.
- Add API contract checks to detect drift between shared DTOs and clients.
- Add end-to-end smoke coverage: admin creates/publishes content, mobile retrieves it, admin archives it, mobile no longer receives it.
- Define environment variable documentation and staging/production secret handling.
- Add structured logs, request IDs, health checks, and minimum error monitoring hooks.
- Define database migration rollout and rollback guidance.
- Add media hosting, CDN, caching, backup, retention, and privacy notes.
- Document release checklist and known v1 limitations.

## Validation

- Run the full root validation pipeline in CI and locally where practical.
- Run the end-to-end flow against a clean database.
- Verify no secrets, local database files, generated client artifacts that should be ignored, or platform credentials are committed.

## Definition of done

- Staging deployment can be reproduced from documented steps.
- The critical user journey is automated.
- Remaining risks and follow-up features are recorded rather than hidden.
