# Plan 00 — Git repository setup

## Goal

Initialize Virtual Mandi as a Git repository connected to the canonical GitHub remote before application implementation begins.

## Scope

- Initialize Git in the repository root if it is not already initialized.
- Configure the project remote as:
  - `origin git@github.com:ankurgahtori/VirtualMandi.git`
- Add repository-level `.gitignore` rules for Node, pnpm, Turbo, Expo/React Native, Next.js, Prisma artifacts, environment files, AWS credentials, IDE files, logs, and OS files.
- Add safe environment templates such as `.env.example` and document that real values must never be committed.
- Add all current planning files and the project-local skill.
- Create the initial commit with a clear message.
- Push the initial commit to the configured remote after confirming SSH authentication and the target branch.

## Safety requirements

- Inspect existing Git state before changing remotes or branches.
- Do not overwrite an existing remote, branch, or user commit without explicit confirmation.
- Never commit `.env`, private keys, AWS credentials, database dumps, signing certificates, or production data.
- If the remote already contains commits, fetch and reconcile history safely instead of force-pushing.

## Validation

- `git remote -v`
- `git status --short`
- `git log --oneline -1`
- Confirm the initial commit is visible on the intended remote branch.

## Definition of done

- The repository has a clean initial commit containing the planning baseline.
- `origin` points to the supplied GitHub repository.
- The remote contains the initial commit, unless authentication or remote-history conflicts require a documented handoff.
