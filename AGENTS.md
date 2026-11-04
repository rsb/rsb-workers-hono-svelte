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

## Finding code

[apps/api/entry-chains.md](apps/api/entry-chains.md) lists every api
entry point and its entry chain, from the route to the data method,
with the file and symbols of each link. It is generated: after
changing a route, a handler, an operation's port or a data method,
run `pnpm gen:entry-chains`.

## Rules

- rl-0009: Owned governance files change only with a recorded exception.
- rl-0011: Workflows pin actions by commit SHA and declare permissions.
- rl-0012: No raw secrets in the repo.
