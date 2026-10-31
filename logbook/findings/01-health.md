# Findings: slice 1, Health

Findings about the code of slice 1. Format: [README](../README.md).
Paths are under `apps/todo/`.

## F1 The body limit runs before routing

- **Seen:** `api/src/app.ts:12` @ 0e70ded
- **Part:** 1b
- **Finding:** `bodyLimit` is the first `.use()`, app-wide, so an
  oversized body is a 413 whatever the path: `POST /health` with 8193
  bytes is `too_large`, not a 404 for the method. The limit is
  `BODY_LIMIT_BYTES` from the contract, not a literal.
- **Outcome:** kept → profile-notes#P31

## F2 adapter-cloudflare 8 has no `event.platform`

- **Seen:** `web/src/routes/health/+page.server.ts:1,5`,
  `web/src/lib/server/health.ts:10` @ 0e70ded
- **Part:** 1b (web), test
- **Finding:** the adapter passes `env` from `cloudflare:workers` to
  the server and never sets `platform`, so a load reaches the binding
  by a module import. The unit tier cannot hand the load a fake
  binding without mocking a module. The load is one line,
  `readHealth(env.API)`, and the unit test calls `readHealth` with a
  fake. The one-line load itself is covered only by e2e. The PRD's
  "unit test of the page load" is met by the function the load
  delegates to, not the load.
- **Outcome:** promoted → profile-notes#P29; open for the owner (is a
  one-line load an acceptable untested seam?)

## F3 Kit 3 removed `$lib`

- **Seen:** `web/package.json:5-7`,
  `web/src/routes/health/+page.server.ts:2` @ 0e70ded
- **Part:** 1a (web config)
- **Finding:** `$lib` is a build error in Kit 3 whose message points
  to `#lib`, a Node subpath import declared in `package.json`
  `imports`. Kit's own test app declares `#lib` and `#lib/*`; this
  repo declares `#lib/*` only and imports with the `.ts` extension,
  as the rest of the repo does.
- **Outcome:** changed (draft §9.1) → profile-notes#P30

## F4 `success` names two things

- **Seen:** `contract/src/envelope.ts:34`, `api/src/respond.ts:14` @ 0e70ded
- **Part:** 6
- **Finding:** the contract's `success` is a schema factory; the api's
  `success` builds a response. Both read naturally in their file, and
  no file imports both today. Slice 2's handlers might.
- **Outcome:** open

## F5 "The cause is logged" is not tested

- **Seen:** `api/src/handlers/error.ts:6`,
  `api/test/unit/handlers/error.test.ts:10` @ 0e70ded
- **Part:** 7, test
- **Finding:** the unit test silences `console.error` with a stub and
  asserts only that the response has no cause. Asserting the log was
  called would be a call-asserting mock (a finding by policy), so the
  PRD's "the cause is logged" is checked by reading the code, at no
  tier. A logger passed in would make the log a returned or recorded
  value, at the cost of a parameter on every handler.
- **Outcome:** open

## F6 Exported handlers that no unit test calls

- **Seen:** `api/src/handlers/{health,not-found,too-large}.ts` @ 0e70ded
- **Part:** test
- **Finding:** C3 exports every handler so the unit tier can call it.
  Only `onError` is unit-tested: it is the one handler the composition
  cannot reach (no route throws). The others are proven at integration,
  and the policy forbids re-proving. So "exported for the unit tier" is
  true of one handler in four; the export is still what makes "one
  handler per file" checkable.
- **Outcome:** kept

## F7 The BFF is silent when the API is down

- **Seen:** `web/src/lib/server/health.ts:14-15,22-23` @ 0e70ded
- **Part:** 7 (web)
- **Finding:** with the API stopped, `/health` renders "The API is
  down." and the dev log shows only `200 GET /health`. Every failure
  becomes `down` with no log line, so an operator sees nothing. The
  web has no logging convention yet.
- **Outcome:** open

## F8 Kind → status lives in the api, typed against the contract

- **Seen:** `api/src/respond.ts:5-11` @ 0e70ded
- **Part:** 6
- **Finding:** the map `satisfies Record<ErrorKind, ContentfulStatusCode>`,
  so a kind added to the contract fails `check` in the api until it has
  a status. `failure` is overloaded so `validation` requires a `field`
  and the other kinds refuse one, matching the contract's `ApiError`.
- **Outcome:** kept → profile-notes#P28

## F9 Playwright's browser build is pinned by its version

- **Seen:** `web/package.json` (`@playwright/test` 1.64.1) @ 0e70ded
- **Part:** test (environment)
- **Finding:** 1.64.1 needs chromium headless shell build 1248. The
  cache had 1169, 1208 and 1243; `~/.cache` is not writable from the
  sandbox and the download host is not allowed. The e2e run used
  `PLAYWRIGHT_BROWSERS_PATH=$TMPDIR/pw-browsers` with build 1243 linked
  under the name 1248, set only in the shell. The scenario passed on
  that older build. The owner's shell should run
  `pnpm --filter @todo/web exec playwright install chromium` once.
- **Outcome:** open (environment) → profile-notes#P35

## F10 Playwright's readiness URL must not be a 404

- **Seen:** `web/playwright.config.ts:16` @ 0e70ded
- **Part:** test
- **Finding:** `webServer.url` accepts 2xx, 3xx and 400–403 only. The
  web has no `/` route, so the web readiness URL is `/health`, which
  also proves the binding before the first test.
- **Outcome:** changed (draft §0.4) → profile-notes#P34

## F11 Telemetry and other outbound calls (P23)

- **Seen:** every `wrangler` run @ 0e70ded
- **Part:** 1a (tooling)
- **Finding:** with `WRANGLER_SEND_METRICS` unset, `check` (`wrangler
  types --check`), `test:integration`, `dev` and `test:e2e` each try
  `sparrow.cloudflare.com`. The sandbox denies it; wrangler prints
  nothing about it and every command exits 0. `wrangler dev` also
  calls `workers.cloudflare.com` to fetch `Request.cf`; when denied it
  prints a warning with a stack trace, uses a placeholder, and serves
  normally. Neither call fails a run. Nothing was set to silence them.
- **Outcome:** open → profile-notes#P23

## F12 `pnpm dev` stops both Workers when one exits

- **Seen:** `package.json:10` (root `dev`) @ 0e70ded
- **Part:** 1a (tooling)
- **Finding:** `pnpm --parallel` is fail-fast: stopping the API Worker
  stopped the web dev server too. To see "down" by hand, the two were
  started with `pnpm --filter … dev` separately. Harmless for daily
  use; it means `pnpm dev` cannot demo the down case.
- **Outcome:** kept

## F13 C4 has no code yet

- **Seen:** `api/src/` (no `result.ts`) @ 0e70ded
- **Part:** 4
- **Finding:** no operation exists, so nothing returns a `Result`, and
  writing `result.ts` now would add an unused module. C4 is checkable
  in slice 1 only by its negative: contract exports no `Result`.
- **Outcome:** open (owner, at the C4 review)

## F14 The import graph holds (C1)

- **Seen:** `*/src` @ 0e70ded
- **Part:** 1a–7
- **Finding:** the bare imports per mount are: contract `valibot`;
  api `hono`, `hono/body-limit`, `hono/utils/http-status`,
  `@todo/contract`; web `cloudflare:workers`, `#lib/...`,
  `@todo/contract`, `valibot`. No relative import climbs two levels,
  `@todo/api` appears nowhere in web, and `fetch` in web is only on
  the binding parameter. The scan is a few `grep`s (P27, P5).
- **Outcome:** kept → profile-notes#P27

## F15 Integration reaches the Worker through `exports`

- **Seen:** `api/test/integration/*.test.ts:2` @ 0e70ded
- **Part:** test
- **Finding:** `SELF` from `cloudflare:test` is deprecated in
  `@cloudflare/vitest-plugin`; the tests use
  `exports.default.fetch()` from `cloudflare:workers`. Its type comes
  from the `mainModule` that `wrangler types` writes once
  `src/index.ts` exists, so the committed `worker-configuration.d.ts`
  changed with the first source file.
- **Outcome:** kept → profile-notes#P33
