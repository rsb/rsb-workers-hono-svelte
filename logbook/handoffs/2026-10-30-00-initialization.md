# Handoff 00: agreements before initialization, 2026-10-30

First record of the paired lab session that shapes, by hand, what the
`workers-hono-svelte` profile should produce. Nothing is built yet. This
file is the shared understanding the owner and Claude reached before any
code, and the only input the next session starts from.

## How we work

- **Paired, not dictated.** Owner and Claude work as two developers at one
  terminal: agree what to build, Claude builds, the owner reviews, both
  discuss, and research better ways when either doubts the approach. The
  aim is discovering patterns an AI agent can use to generate predictable,
  maintainable code, not following a known path.
- **Who decides what.** The owner arbitrates composition, flow and
  relationships (which module exports what, who may import whom, the
  order a request moves through the code). Claude proposes details
  (naming, idioms, type threading, test shape) with a one-line reason;
  they stand unless objected to. A detail that encodes a relationship is
  composition. Sound argument wins; if neither side can name a
  measurement that would prove the other wrong, it is a heuristic, not a
  rule.
- **The loop per stage.** Draft agreed → Claude writes it and runs the
  mechanical checks, showing the output → owner reviews → discussion →
  logbook entries written with the code → local commit by Claude → owner
  runs `git push` and `gh` (the sandbox denies Claude `~/.config/gh` and
  `~/.ssh`; run them with `! <command>`). Drafts longer than a few lines
  are written to a file for review, since the console is hard to read.
- **Stage boundary.** Every successful stage ends with a handoff in
  `logbook/handoffs/` (what we did, where we are, next steps) and a PR
  that reflects the shared understanding. After merge the owner clears
  Claude's context; the next session begins by reading the latest handoff.
- **Commits.** Conventional commits, no Co-Authored-By or any
  attribution. Claude never pushes.
- **Not factory work.** No tickets, no agent-box, no Gauge, no spec ids.

## Sources

Read for context:
- `~/code/software/rsb/research/rsb-workflow/decisions/2026-10-29-exposures-echo-reference-and-testing.md`
  §3 (template exercise, working agreement), §4 (testing model)
- `.../decisions/2026-10-26-registry-entities-releases-blueprints.md`
  (rule, heuristic, check, pattern, blueprint and template)
- `.../decisions/2026-10-27-profile-components.md` (root chain, mounts,
  ownership; `engineering/` retired by decision 9)
- `.../decisions/2026-10-30-echo-prd-naming-and-spec.md` (per-app layout,
  test-tier commands, health test precedents)
- `~/code/software/rsb/reference/reference-workers-hono-svelte/prd/echo.md`
  (envelope, shape constraints)
- The reference repo's `main` branch for governance file shapes only,
  via `git show main:<path>` (the working copy is on `run/001`).

Never read: branch `run/001` of the reference repo, or anything under
`~/.local/share/gauge`. They are experiment samples and must not anchor
this work.

## Fixed inputs (from the owner's brief)

- **App:** a todo app. Its behaviour is a vehicle; the subject is code
  flow and architecture.
- **Stack:** pnpm monorepo, `apps/todo/{api,web,contract}`. API: Hono on
  Cloudflare Workers, reached only over a service binding. Web: SvelteKit
  (Svelte 5), Cloudflare adapter, the only public Worker. Contract:
  shapes and validation rules both share. TypeScript throughout. Node
  26.13.0 and pnpm 12.5.1 pinned exactly, engine-strict. Local only, no
  deploy.
- **Root commands:** `dev`, `check`, `test:unit`, `test:integration`,
  `test:e2e`, and `test` as a guard that exits 1 naming the three tiers.
- **Envelope:** every API response is `{ok:true,data}` or
  `{ok:false,error:{kind,message,field?}}`, including not-found and the
  error handler. Kinds: `validation` (422), `not_found` (404),
  `internal` (500, added for the error handler).
- **Errors on the request path are returned values, never thrown.**
- **Data:** an in-memory store behind a port from the first slice; the
  owner decides when and whether a real database replaces it.
- **The seven parts of a request**, each file placeable in exactly one:
  1a startup before the request; 1b startup along the request path;
  2 entry point (route registration only, handlers elsewhere); 3 input
  validation; 4 operation; 5 data package; 6 response building; 7 error
  handling and logging.
- **Vertical slices** named by the owner, one at a time, each crossing
  contract, API and web, each testable at all three tiers.

## Testing policy (understanding confirmed by the owner)

From 10-29 §4, 10-30 §3 and the brief:
- **Unit:** code shape and flow, not behaviour. Public interfaces only,
  separate `test/` folder. One case per declared failure in the order the
  code can hit them, success last; assert the returned value. Stubs and
  fakes allowed; a call-asserting mock is a finding. No real data
  packages, no adapter imports, no network, database env or filesystem.
- **Integration:** real composition (1a) booted once, one route hit,
  Workers runtime via `@cloudflare/vitest-pool-workers`. Never mocks
  (heuristic; exception: third parties that cannot run locally).
- **E2E:** Playwright through the BFF, black box; runs exactly the agreed
  acceptance scenarios (Given/When/Then); `test:e2e` starts the stack.
- One root command per tier, never bundled. No re-proving across tiers.
  Containment candidates: no deleting or weakening a test unless agreed;
  tests touch public interfaces only.
- Echo precedents: unknown route → integration; "API down" → unit test
  of the page load with a stub binding, not e2e.

## Decisions

### Lab record: `logbook/`

Lab-only material lives under `logbook/`, never produced by a mint.
Rejected: `design/` (reads as application design), `engineering/`
(already means repo rule text in the factory, retired by 10-27 decision
9), `lab/` (Gauge's Lab cases), `fieldnotes/` and `study/` (words already
in use in the factory docs).

```
logbook/
├─ README.md               lab record, not produced by a mint   (init stage)
├─ profile-notes.md        candidate registry entities          (init stage)
├─ findings/NN-<slice>.md  findings about the code, per slice
└─ handoffs/               one per stage
```

profile-notes entry: kind (rule | heuristic | check | pattern | template),
one-line statement, realized by (path:lines), machine-checkable
(exact | approximate | judgement | no, and how), slice, status.

Findings entry: seen (path:lines @ commit), part (1a…7 | test), finding,
outcome (kept | changed (commit) | promoted → profile-notes#entry | open).

### Repo layout (L1–L5 agreed)

```
.                     root chain: base › service › pnpm-monorepo › cloudflare › rsb-workers-hono-svelte
├─ AGENTS.md  .rsb/governance.lock  .github/workflows/scorecard.yml
├─ .node-version  .gitignore  package.json  pnpm-workspace.yaml  pnpm-lock.yaml  tsconfig.base.json
├─ prd/todo.md
├─ logbook/
├─ tools/             reserved, not created until needed
├─ packages/          shared libraries; todo adds none
└─ apps/todo/
   ├─ api/            mount: hono-api › hono-api-workers
   ├─ web/            mount: svelte-bff › svelte-bff-workers (holds e2e/ and playwright.config.ts)
   └─ contract/       mount: api-contract (depends on nothing; api and web depend on it)
```

- **L1** Governance files (`AGENTS.md`, lockfile, `scorecard.yml`) are
  included though nothing validates them: they are profile output, and
  the lockfile records the mount composition. `registry_rev` and rules
  (rl-0009, rl-0011, rl-0012) copied from the reference lockfile, same
  chain. `scorecard.yml` never runs here (local only).
- **L2** The spec lives at `prd/todo.md`, matching the factory's
  `prd/<app>.md`; no `specs/S-NNNN`.
- **L3** E2E lives in the web mount: e2e goes through the BFF, and a
  root `e2e/` would be repo-leaf owned and mix apps. Cost: web's
  Playwright config starts the API too (a reference across mounts).
- **L4** No debt baseline file yet (10-29 §1.1 wants one; its format is
  open). Recorded in profile-notes as a known gap so an invented format
  does not anchor the question.
- **L5** Store port and in-memory adapter start inside the api mount
  (`src/data/`). Who owns the port if a db package arrives (api or db)
  is decided at that slice.

### Spec source

- **TodoMVC `app-spec.md`, Functionality section only** (lines 80–122),
  pinned `tastejs/todomvc@ff43b02e59dfa604386bb382034b2cd07c2bcd8a`, MIT
  (`license.md`). Copied verbatim into `prd/todo.md` with attribution.
  The rest (directory structure with `controllers/` and `models/`,
  README, dependencies, code style) is submission guidance for their repo
  and is left out so no MVC vocabulary anchors the code. "Filtered on a
  model level" (routing) means the list of todos, not a code layer.
- **Todo-Backend** (`TodoBackend/todo-backend-js-spec@9fdf6f9`) has no
  licence: cited only, never copied. Most of it conflicts with the
  constraints (bare JSON, CORS, per-todo `url`, `DELETE /`, `order`).
  Field names shared with TodoMVC: `title`, `completed`.
- Deviations from upstream are listed in `prd/todo.md`, each justified by
  a fixed constraint; one without such a reason is dropped. Known
  deviations: envelope; API not public (no CORS, no `url`); persistence
  in the API's store, surviving reload but not restart, instead of
  localStorage; real routes or a query instead of hash routes and
  Flatiron Director; DOM selectors (`#main`, `.destroy`, `<strong>`,
  `.editing`) dropped, behaviour kept; health added (ours).
- Once agreed, `prd/todo.md` is frozen.

### Draft slice plan (not yet agreed)

| # | Slice                | Upstream sections                |
|---|----------------------|----------------------------------|
| 1 | Health               | ours; settles 1a/1b              |
| 2 | Add and list         | New todo, No todos, Persistence  |
| 3 | Toggle one + counter | Item 1, Counter                  |
| 4 | Edit                 | Item 2, Editing                  |
| 5 | Delete               | Item 3                           |
| 6 | Mark all as complete | Mark all as complete             |
| 7 | Clear completed      | Clear completed                  |
| 8 | Filter               | Routing                          |

## Open

Spec, to settle while writing `prd/todo.md`:
- **S1** API surface. Draft: `GET /health`, `GET /todos`, `POST /todos`,
  `PATCH /todos/:id`, `DELETE /todos/:id`, `PATCH /todos {completed}`
  (mark all), `DELETE /todos?completed=true` (clear completed). Bulk as
  collection verbs or named actions?
- **S2** Filter in the API (`?filter=`, puts part 3 on a GET; Claude
  leans here) or in the BFF.
- **S3** Title length limit: add one marked as ours (echo used 280), or
  none, as upstream.
- **S4** Works without JavaScript (SvelteKit form actions), deciding
  whether every mutation goes page → BFF action → API.
- **S5** UI-only behaviours (Escape discards, blur saves, counter
  pluralisation, mark-all state): several acceptance scenarios per slice
  (Claude recommends; traceable to upstream) or one per slice with the
  rest at unit.

Slice 1 composition, from Claude's first proposal, not yet discussed:
- **C1** Import graph: api → contract, web → contract, contract → none;
  web never imports api; inside api routes → handlers → operations →
  data port; only `index.ts` imports an adapter.
- **C2** Health pings the store port (adds kind `unavailable`, 503) or
  stays pure.
- **C3** Handler placement: part 4's HTTP face, with `operations/` as
  the pure core, or otherwise.
- **C4** `Result<T,E>` hand-rolled and private to the api, or shared.
- **C5** Web has unit and e2e but no integration tier; the slice covers
  all three tiers across packages.
- Correction already noted: unknown route → integration (not a unit test
  of `createApp`); the `internal` handler is unit-tested through its own
  exported function.

Details Claude proposed, standing unless objected to: zod v4 in contract
(first-party adapters in Hono and SvelteKit); contract shipped as TS
source (no build step to drift); package names `@todo/{api,web,contract}`
(name mirrors path); one named export per handler and operation file
(makes "one route, one handler file" checkable).

## Environment

- The `pnpm` first on PATH is a vite-plus shim that fails in the sandbox
  (read-only filesystem). Use `~/.local/share/pnpm/bin/pnpm` (12.5.1).
- Network: `registry.npmjs.org` and `api.github.com` are reachable;
  `raw.githubusercontent.com` is not (fetch files through the contents
  API with `Accept: application/vnd.github.raw`).
- Playwright's chromium is already in `~/.cache/ms-playwright`.
- `gh` and `git push` are the owner's to run.
- `main` starts with an empty root commit; this handoff arrives by PR
  from `handoff/00-initialization`.

## Next step: repo initialization

Everything needed to start, no application code. Scope agreed:
- Root: `package.json` (pins, five scripts, `test` guard),
  `pnpm-workspace.yaml` (engine-strict), `.node-version`, `.gitignore`
  (including `.claude/`), `tsconfig.base.json`.
- Governance: `AGENTS.md`, `.rsb/governance.lock`, `scorecard.yml`.
- Logbook: `README.md`, `profile-notes.md` (entries for init's own
  choices), `findings/`.
- Spec: `prd/todo.md` (pinned Functionality section and deviations),
  settling S1–S5.
- App folders configured, no source: `package.json` and `tsconfig.json`
  per mount; `wrangler.jsonc` for api and web with the binding;
  `svelte.config.js`; vitest unit and integration configs and the
  Playwright config; dependencies installed, lockfile committed.
- Done when `pnpm install` and `pnpm check` pass and `pnpm test` exits 1
  naming the tiers. Open: whether `test:*` pass on empty
  (`--passWithNoTests`; Claude recommends) or are stubbed until slice 1.

Start the next session by reading this file, then draft initialization
file by file for the owner, in a file, before writing anything.
