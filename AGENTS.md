# AGENTS.md

This repo is a lab for the `workers-hono-svelte` profile: a todo app
built by hand, slice by slice, to find what the profile should
produce. What to build is in [prd/todo.md](prd/todo.md). `logbook/`
is the lab record, not part of the app.

## Commands

Run from the root:

- `pnpm install`
- `pnpm dev`
- `pnpm check`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm test` fails on purpose and names `test:unit`, `test:integration` and `test:e2e`.

## Rules

- rl-0009: Owned governance files change only with a recorded exception.
- rl-0011: Workflows pin actions by commit SHA and declare permissions.
- rl-0012: No raw secrets in the repo.
