# rsb-workers-hono-svelte

A lab for the `workers-hono-svelte` profile: a todo app on Cloudflare
Workers, built by hand, slice by slice, to find what the profile should
produce. The spec is [prd/todo.md](prd/todo.md), and the lab record is
in [logbook/](logbook/README.md).

## Run

Needs Node 26.13.0 and pnpm 12.5.1 (enforced by `engines`).

```sh
pnpm install
pnpm seed:dev          # a dev member and admin, each with a session (prints their cookies)
pnpm dev               # start the API and web Workers locally
pnpm check             # verify binding types, type-check every package
pnpm test:unit         # run the unit tests
pnpm test:integration  # run the integration tests (API, in the Workers runtime)
pnpm test:e2e          # run the end-to-end tests (Playwright starts both Workers)
```

There is no bundled test run. Each tier runs on its own, and
`pnpm test` fails with a message naming the three.

With `pnpm dev` running, http://localhost:5173/health shows whether
the BFF reaches the API through the binding.

`pnpm seed:dev` writes `SESSION_COOKIE=sid` and a random `PEPPER_1`
(the secret password hashes are keyed with) to `apps/api/.dev.vars`,
and the two raw session tokens to `apps/api/.dev.tokens`, each only
when missing; both files are gitignored. The api does not start without
`PEPPER_1`, so run the seed once before `pnpm dev`. `test:e2e` seeds its
own fresh database with the same tokens.

## Layout

```
apps/
  api/              Hono API Worker, not public: reached only through the BFF's service binding
  bff/              SvelteKit BFF Worker, form actions to the API
packages/
  contract/api/     the api's contract: schemas, types and limits (valibot)
  business/         business types, rules and Result
  operations/       operations, each with the ports it needs
  data/d1/          a D1 database as the DbStore, with its migrations
prd/                what to build
logbook/            handoffs, drafts, findings and profile notes; not part of the app
```

Agent instructions are in [AGENTS.md](AGENTS.md).
