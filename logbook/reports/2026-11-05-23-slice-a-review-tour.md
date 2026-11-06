# Review tour: stage 23 (authentication, slice A), 2026-11-05

Claude wrote this tour of stage 23 for the owner to review. It is a
written tour; nobody led it live. Stage 23 builds slice A of handoff
23: every todo belongs to a user, and every request carries an actor,
before any sign-in exists. The actor comes from a seeded session row,
so the real gate path runs from the first commit and nothing in the
gate knows about environments. The decisions are L37–L43, now in the
api story's ledger and its new chapter 15.

The stage is thirteen commits and one fix, from `main` at `75722af`.
They were reordered after commit 3 so that each one leaves check,
unit, tooling and e2e green. They landed in six PRs:

| # | Commit | What | PR |
| --- | --- | --- | --- |
| 1 | `5cd5e74` `docs(prd)` | stage 22's eight template proposals | #47 |
| 2 | `80f277a` `docs(prd)` | slice A's specs: `access.md`, `data/identity.md`, the shell | #47 |
| | `c41e379` `test(tooling)` | count the eighth use case (section 1) | #47 |
| 3 | `139a376` `feat(gates)` | the `authenticate` unit and the dependency rule | #47 |
| 4 | `2b1d122` `feat(data)` | the identity database beside the app's | #48 |
| 5 | `c6c097a` `feat(api)` | the gates attach an actor | #49 |
| 6 | `4b538c3` `chore(api)` | the dev seed | #50 |
| 7 | `a354509` `feat(bff)` | the BFF forwards the browser's session | #51 |
| 8 | `4b89076` `feat(operations)` | ownership and the access runner | #52 |
| 9 | `4ec1662` `feat(api)` | `GET /sessions/current`; `Security:` checked against `access.md` | #52 |
| 10 | `4b90fea` `feat(bff)` | the shell and the error view | #52 |
| 11 | `3db8425` `feat(api)` | the config through one schema; `check:config` | #52 |
| | `42b39f5` `fix(api)` | the integration Worker gets local dev's config (section 6) | #52 |
| 12 | `626065b` `docs(logbook)` | the pillars, the threats table and the pillars view | this branch |
| 13 | this commit, `docs(logbook)` | this tour, the story, the glossary, handoff 12's row O | this branch |

The branch for 12 and 13 is `docs/auth-slice-a-story`, made from
`main` at `cb48182`.

Checks, in CI order, on a tree with `apps/api/.dev.vars` set aside
(section 6 says why), after commit 12:

| Step | Result |
| --- | --- |
| `pnpm check` | exits 0 |
| `node --test tooling/` | 217 pass |
| `pnpm test:unit` | 555 pass |
| `pnpm test:integration` | 70 pass |
| `check:api`, `check:access`, `check:rules`, `check:entry-chains`, `check:join` | exit 0 |
| `pnpm test:e2e` | 51 pass (41 before the stage) |

Before any change, `pnpm test:e2e` on the branch passed 41 of 41, with
`/health` reaching the api through the `API` binding: `vite dev` to
`wrangler dev` 4.156, with no `CLOUDFLARE_DEV_REGISTRY_PATH` needed.
That was the one path the research could not verify end to end.

## 1. Specs first, and the use case count

Commit 2 wrote `access.md`, `data/identity.md` and the shell's use
case, `current-session`, before any code. The owner's reading, when
the order was questioned: specs that a check reads against code land
with the code that satisfies them, so the pipeline groups commits by
what must be true together. That is not a workaround.

Commit 2 also broke a tooling test that counted seven use cases. The
fix was its own commit, `c41e379`, before the gates commit `139a376`,
so the gates commit holds only the gates.

## 2. The gates (commits 3 and 5)

`packages/gates` holds one unit, `authenticate`. Its test runs every
branch of L39 with a fixed `now` and a fake `sessions` reader. The
dependency rule is in `tooling/deps/matrix.test.ts`: `gates` imports
`business` and `fail` only, and `operations` and `data` never import
it.

The owner's wording for L39, as recorded: a cookie and a bearer token
together are refused as `unauthenticated`, because a request proves
itself one way.

Commit 5 took the `unauthenticated` and `forbidden` kinds, and
`reason`, from commit 9, since the gates are the first to refuse with
them: a kind lands with its first refusal. The BFF's words for the two
were interim until commit 10's error view. The PR said the new kinds
are refused only on inputs no current client sends.

The session row's shape is defined once, in
`business/auth/session.ts`, so the gate's port and the store's result
share it. Both may import business, and the duplicate the first draft
had is gone (owner, after commit 4).

The api's unit tests build the whole api, gates included, through one
`testApi` helper. A stand-in `/whoami` route read what the gates
attached until `GET /sessions/current` existed.

## 3. Identity data and the seed (commits 4 and 6)

The identity database holds `users` and `sessions`; `credentials` and
`verifications` wait for slices B and C. Two state names stood for the
scope work from commit 5: `todo.owned`, a state rule, and
`todos.scoped`, a guarantee.

The seed, `pnpm seed:dev`, calls the stores (`users.create`,
`sessions.start`), so it breaks when the store does. It makes one
member and one admin.

**Where the raw tokens live.** Q1 said `.dev.vars`. They live in
`apps/api/.dev.tokens`, gitignored, because `.dev.vars` becomes the
Worker's env, and the api must never hold a raw token, in dev
included: it sees only the digest. A token there also broke
`wrangler types --check`, which is how the problem surfaced, not why
the tokens moved.

`SESSION_COOKIE=sid` in `.dev.vars` broke the same check against the
literal type `"__Host-sid"`. So `types` and `check` run with
`--strict-vars=false`, and the owner confirmed the vars are typed as
`string`.

## 4. The BFF forwards the session (commit 7)

The BFF reaches the api through `locals.api`, set in `handle`. It
forwards `Cookie`, `Origin`, `Sec-Fetch-Site` and `Sec-Fetch-Mode`.
The owner asked that the e2e scenario include a form action's POST
through the `channel` gate, not only a page load, and a refusal from
another origin if the harness could send one. It does both.

**The gate's first catch.** The BFF sent its writes as a string body,
which `fetch` types `text/plain`, the CSRF-friendly type that needs no
preflight. The gate refused our own BFF's writes until they declared
`application/json`.

**A dev-only refusal.** Under local dev the binding's proxy,
Miniflare through `getPlatformProxy`, refuses a foreign `Origin`
itself, with a plain-text `403 Invalid Origin header` the api never
sees, and the BFF reads that as unreadable (500). So the e2e
cross-site post sends `Sec-Fetch-Site: cross-site` without `Origin`,
and the gate's `Origin` fallback stays with its unit tests.
Production's service binding is not that proxy. Both findings are in
`threats.md`'s row 1.

## 5. Ownership, the runner and the actor read (commits 8 and 9)

**The runner.** `run` wraps each operation's builder in
`packages/operations`, so a built operation carries its own check, and
the scope's type comes from its generated row (`ScopeOf<N>`). No
delivery applies it. This replaced the Q3 answer, which put it in
`route()`. An `n/a` row hands the body the actor: `currentSession`'s
input is the actor.

`currentSession` was built in commit 8 with no route, so `access.md`'s
eighth row named a real operation and `check:access` held; commit 9
routed it. The entry chain reader learned to read `name: builder(),`
for an operation with no port.

**The dynamic access test** is `apps/api/test/unit/access.test.ts`,
over construct's operations, since only construct builds them all. It
works out each verdict itself, apart from the runner, and checks each
built function is `run`'s under its own name (`operationOf`).
`check:access` is not a CI step, since `scorecard.yml` is rl-0009's.
`tooling/access/generate.test.ts` runs `--check` on the committed
table under `pnpm test:tooling`, which CI runs.

**Scope SQL** is one of two fixed terms, `user_id = ?n` or `TRUE`,
after the statement's own placeholders. The index `todos(user_id)`
keeps the rowid after the key, so an owner's list comes in `seq` order
with no sort. Migration 0002 rebuilds the table and drops every todo:
none has an honest owner, and nothing is deployed. Its comment says
so, as the owner asked.

**The ordering finding, and the choice.** The handler validated before
the operation ran, so an anonymous request with a bad body answered
422, not 401. The owner decided: in commit 9 `route()` mirrors the
access row, so 401 and 403 come before 400 and 422. The runner stays
the authority. This is a presentation choice, and the type test shows
that a route whose unit has no row does not compile. A construct test
pins anonymous with a bad body or query as 401.

**The made-up admin row.** No real route can show the route's 403
`role` mirror yet, since every row is `member` or `anonymous`. So
`apps/api/test/unit/route.test.ts` shows it on an admin row made up for
the test. The owner: that row is the proof of the 403 `role` refusal
until slice D's `listUsers` retires it.

**Tests sign in by bearer.** The api's tests use a bearer token (unit:
`signedIn`; integration: `seed-sessions.ts` and `fetchAs`), since the
`channel` gate checks only the cookie.

**A cost, shown as a number.** The 500-add cap test now needs 30
seconds: each request is one identity lookup more, so it makes 500
extra identity round trips. The owner: expected, and worth recording
as a performance signal.

**`Security:`** is now required on every endpoint in `api.md`, in
`access.md`'s words, between `Applies:` and `Path:`. `gen:api` and
`check:api` take `access.md` as a second argument and refuse an
endpoint whose `Security:` is not its unit's row; a probe must say
`anonymous`. OpenAPI gets the `session` scheme (an apiKey in the
cookie `__Host-sid`) and `bearer`; each operation lists both, adds
`{}` when anonymous may call, and says the role as `x-requires`. The
cookie name is a constant in `emit-openapi.ts`, held equal to
`wrangler.jsonc`'s `SESSION_COOKIE` by a tooling test.

**`GET /sessions/current`** replies `{ user?, clearCookie }`; no
`user` means anonymous, since the contract has no unions. A signed-in
actor with no profile is a logged server fault. Its budget is 0
`DbStore` calls. The examples replay sends it as the member, and a
success is checked against the schema only, so the anonymous and
stale-cookie examples pass as written.

**The entry chain index** lists the gates first, in
`constructGates`' order, then the runner (`run, verdict`), then
`http`, errors, handlers and the driver. A unit that declares no port
ends its chain at the unit:
`GET /sessions/current → getCurrentSession → currentSession`. The
owner asked that this sentence go into the gates chapter, and it is
there (story, chapter 15). `run.ts` is listed once at the top, beside
the gates, as a shared link.

## 6. The shell, the error view and the config (commits 10 and 11)

**The cookie's name in dev.** The BFF branches on dev for the cookie's
name (`sessionCookie(dev)`: `sid` in dev, `__Host-sid` deployed). That
is a browser transport fact, which the delivery owns: no browser
accepts a `__Host-` cookie over http. The api never branches; it reads
its name from config. `tooling/config/session-cookie.test.ts` keeps the
two names equal.

**The frame.** The root `+layout.server.ts` reads the actor once per
page load (`loadFrame`). It deletes a stale cookie when the reply says
`clearCookie`, and it never throws: an error thrown in the root
layout's load skips `+error.svelte` for the bare `src/error.html`. A
failed actor read renders `accounts.error.failed` in the frame, with
no account button. The probe `/health` has no frame and spends no
actor read. It is not a page of the app (deviation 13), and a failed
read must not hide it. That was not in the plan; it is a finding of
building it.

`signed_out` comes from the runner: the page still calls
`list-todos`, and its `unauthenticated` refusal is page data. Any
other refusal is thrown as a fault. `refusal()` and `failedMessage()`
switch over every kind and every `Reason`, with `never` defaults, so
slice D adds `role`'s view and words there.

**A correction before committing.** I first said `handleError` sees
only unexpected errors, so `error(500)` would skip it. That was
SvelteKit 2's behaviour. In the installed Kit 3.1.0 the server hook
gets every error but a redirect, told apart by `kind` (`app`,
`framework`, `validation`, `unknown`), and may return `status` and
`message`. The research and the migration guide were right; my reading
was wrong. So `handleError` is the one funnel: `App.Error` carries
`view`, `shellError` chooses it by status, and both hooks return it.
`+error.svelte` only draws `page.error.view`. A failed read in
`load-todos` is a thrown fault, not `error(500)`, which is kept for a
status a page chooses (slice D's 403s).

Smaller points: a page load is the layout's and the page's loads side
by side, so 2 api calls on `/` and 3 on the filters. "No links in the
top bar" keeps the product name's link to `/`, as every board draws
it. "Try again" is a link to the same URL with
`data-sveltekit-reload`, so it works without JS. SvelteKit 3 deprecates
`$app/environment`, and `dev` comes from `$app/env`.

**Config fails closed, without a throw.** `index.ts` keeps
`readConfig`'s Result; a config that does not read exports
`misconfigured(problems)`, which answers every request 500 `internal`
and logs the problems on the first request (story, chapter 2). The
owner first worded the reply "the configuration is invalid", then
called it wrong: that is a cause, and every `internal` says `internal
error`.

**The CI regression, and its lesson.** Commit 11 made the committed
wrangler vars fail the config check: a local `BFF_ORIGIN` beside the
deployed `__Host-sid`. I wrote that nothing runs that pair, and the
owner chose to check what runs, the committed vars with `.dev.vars`
over them.

CI then failed `test:integration`, 61 of 70. The integration Worker
reads `wrangler.jsonc`, and CI has no `.dev.vars`: it is gitignored,
written only by the seed, and only `dev:e2e` runs the seed. So CI ran
the committed vars alone, which commit 11 made unreadable, and every
request answered 500 `internal`. Locally it passed only because my
`.dev.vars` held `sid`. "Nothing runs that pair" was wrong: CI's
integration suite ran it. Before commit 11 it ran a `__Host-` name over
http unnoticed, since the Worker reads `Cookie` headers and no browser
was involved.

The fix, `42b39f5`, binds `SESSION_COOKIE: "sid"` in
`vitest.integration.config.ts`, local dev's overlay, so the run no
longer depends on a gitignored file. Setting `.dev.vars` aside
reproduced it: 61 failed before the fix, 70 passed after.

The lesson, for the profile: a check run locally with a gitignored
file present is not the check CI runs. Run the CI order on a tree
with no ignored files. Every commit since has been checked that way.

**B's shape, which is the deploy stage's shape.** Checking a deployed
config is carried with the secrets half, whose trigger is Turnstile
and a deploy workflow. When it comes, `wrangler.jsonc`'s base vars
become local dev's (`http://localhost:5173`, `sid`), and the deployed
values move to an `env.production` block beside the deploy workflow,
which the check then reads. That reverses commit 6's arrangement and
the two tests that read the deployed cookie name from the base vars.

## 7. The pillars (commit 12)

`logbook/threats.md` did not exist, so commit 12 made three files:
`pillars.md`, `threats.md`, and `tooling/pillars/`, which renders
`pillars-view.md` (`pnpm gen:pillars`). None of them holds a check, a
gate or a tag: the view exits 0 whatever it reads.

- **Security** counts only tests that exist: 3 of 13 (rows 1, 4 and
  13). The design's section 9 named the kind of test each row would
  get, 11 of 13; a number counted from planned tests would be wrong.
- **Reliability** and **performance** read the suites' JSON reports.
  Every vitest config writes `test-results/<level>.json`, and
  Playwright writes `test-results/e2e.json`. Playwright empties its
  output directory on each run, which would have deleted the BFF's
  `unit.json`, so its own output moved to `test-results/e2e/`. The
  reports are found from the configs, so a new package shows up
  without a list to keep.
- **Performance** reads pass or fail per budgets file, since the
  numbers are written in the tests. Backlog row O, added to handoff
  12 as a small item, not for this stage: budgets as a data file the
  tests read, so the view prints the numbers.
- **Maintainability** runs the five checks as `package.json` says.

First render: unit 555/555, integration 70/70, e2e 51/51; 3 of 13
threats; the budgets pass, 9, 9 and 12; all five checks hold. The
render date stays, since the view is regenerated at stage end only;
it goes if it becomes diff noise.

## 8. Carried

- Checking a deployed config, and CI's secrets (section 6, B's shape).
- `unavailable` (503) for a config that does not read, with backlog
  E's PRD deviation.
- Backlog O, the budgets as data.
- Ten of the thirteen threats have no test; their slices bring them.
- The made-up admin row, until slice D.
- Slices B to E, as handoff 23 names them.

## 9. Story delta

- The api story records L37–L43 in the ledger, in place of the line
  that held their place, each saying what stage 23 built.
- Chapter 15, new: the gates. A gate is a stage (L37); the api's
  gates in order, with `channel` (L38); authentication as a gate and
  authorization as the runner's, declared, generated, applied and
  mirrored (L39); sessions as rows (L40); areas and processes (L41);
  two databases (L42); ownership as a scope (L43); and the gates in
  the entry chain index, where a unit that declares no port ends its
  chain at the unit. It is numbered last so references to 1–14 stay
  correct.
- Chapter 1: the per-request half is the gates; its two open items
  close.
- Chapter 2: `index.ts` has three steps and `misconfigured`; the
  config-failure open item closes.
- Chapter 3: "One schema, two readers", `check:config`, what the check
  reads, and the deployed-config check as Open.
- Chapter 8: the D1 package holds two databases, with a migrations
  folder each; `identity.md` exists.
- Chapter 13: the kinds table gains `unauthenticated` and `forbidden`.
- The layout tree gains `apps/api/src/gates/` and `packages/gates/`.
- Glossary:
  - new section "Gates and identity": Gate, Binding (of a gate), Unit
    (of a gate), Credential, Channel, Actor, Scope, Identity database,
    App database;
  - new: Step record, after Process, target (backlog G);
  - Process amended: it may compose operations across areas (L41);
  - Entry chain: the gates are in it (L37);
  - Area: areas no longer share one database (L42);
  - Open loses "authentication and authorization, as subsystems".
- Handoff 12 gains backlog row O.
- The BFF story is not touched. It is still the slice 2 first pass,
  and its next revision should tell `locals.api`, the frame and
  `handleError` as the one funnel (section 6).
