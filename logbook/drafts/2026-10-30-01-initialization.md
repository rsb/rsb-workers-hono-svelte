# Draft: repo initialization (for review)

Working file for the init stage, from handoff 00. Nothing is written
yet. This file is kept in the logbook as the record of the draft
step and committed with the stage. Each section names the
file, its content, and anything you need to decide. **[you]** marks a
composition question that is yours to decide. **[detail]** marks a
detail that stands unless you object.

## 0. Things found while reading the sources

1. **`@cloudflare/vitest-pool-workers` is deprecated.** Its 0.23.0
   README says it was renamed to `@cloudflare/vitest-plugin` and will
   get no more updates. 0.23 only accepts vitest `^4.1`. The new package
   (1.4.11) accepts `^4.1 || ^5.0`. Its interface is a Vite plugin,
   `cloudflareTest({ wrangler: { configPath } })`. **Proposal:** use
   `@cloudflare/vitest-plugin` with vitest 5.0.5. The testing policy
   names the old package, and the reference uses it as the name of the
   tool, not of a version. Rejected: pinning the deprecated package.
2. **TypeScript 7.0.2 is `latest`, but `@sveltejs/kit` 3.1.1 requires
   `typescript ^6.0.0`, and svelte-check 4.7.7 requires `^5 || ^6`.**
   **Proposal:** TypeScript 6.0.3. Recorded as a profile-notes entry,
   since a mint would hit the same pin.
3. **Commit attribution.** Handoff 00 says "no Co-Authored-By or any
   attribution". The handoff is your instruction, so I follow it.
4. **pnpm's `test` guard is not built in.** It is the reference's
   one-line script, copied as is.

## 1. Versions (all exact, see §2 `catalog`)

| package | version | used by |
|---|---|---|
| typescript | 6.0.3 | all |
| valibot | 1.5.0 | contract (api and web through contract) |
| hono | 4.13.14 | api |
| @hono/valibot-validator | 0.6.2 | api |
| wrangler | 4.156.0 | api, web |
| @cloudflare/vitest-plugin | 1.4.11 | api (integration) |
| vitest | 5.0.5 | api, web, contract (unit) |
| @sveltejs/kit | 3.1.1 | web |
| svelte | 5.57.3 | web |
| @sveltejs/vite-plugin-svelte | 7.3.1 | web |
| @sveltejs/adapter-cloudflare | 8.0.2 | web |
| vite | 8.3.5 | web |
| svelte-check | 4.7.7 | web |
| @playwright/test | 1.64.1 | web (e2e) |
| @types/node | 26.6.6 | web (playwright config) |

Workers types come from `wrangler types`, not
`@cloudflare/workers-types`. Cloudflare now recommends this, and the
output follows the `compatibility_date` and bindings in
`wrangler.jsonc`, so a binding can't drift from its type.

## 2. Root

### `package.json`

```json
{
  "name": "rsb-workers-hono-svelte",
  "private": true,
  "packageManager": "pnpm@12.5.1",
  "engines": { "node": "26.13.0", "pnpm": "12.5.1" },
  "scripts": {
    "dev": "pnpm --parallel --filter \"./apps/todo/*\" dev",
    "check": "pnpm -r check",
    "test:unit": "pnpm -r --if-present test:unit",
    "test:integration": "pnpm -r --if-present test:integration",
    "test:e2e": "pnpm --filter @todo/web test:e2e",
    "test": "echo \"no bundled test run: use pnpm test:unit, pnpm test:integration or pnpm test:e2e\" >&2; exit 1"
  }
}
```

- **[you]** `dev` runs `wrangler dev` (api) and `vite dev` (web) side
  by side. The web dev server reaches the api through wrangler's
  local dev registry: adapter-cloudflare's platform proxy reads
  `services` from `web/wrangler.jsonc`. The alternative is a single
  `wrangler dev -c api/wrangler.jsonc -c web/wrangler.jsonc` over a
  built web. That gives one process and the real binding, but no
  Svelte HMR. I recommend the first; it is verified in slice 1, when
  there is something to bind to. `dev` cannot run before slice 1
  because `src/index.ts` doesn't exist yet. It isn't in the done
  criteria.
- **[detail]** `pnpm` is pinned in `engines` as well as
  `packageManager`, because engine-strict only enforces `engines`.
- **[detail]** `test:e2e` filters to web by name, not with `-r`: there
  is exactly one e2e owner (L3), and `-r` would hide a second one if
  someone added it.

### `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*/*
  - packages/*

engineStrict: true
saveExact: true

catalog:
  typescript: 6.0.3
  valibot: 1.5.0
  vitest: 5.0.5
  wrangler: 4.156.0
```

- **[detail]** The catalog holds only the versions more than one mount
  uses. Each mount writes `"catalog:"` for those and pins its own
  packages exactly. Reason: one place to bump shared tools. 10-27
  gives the catalog to the `pnpm-monorepo` node.
- `apps/*/*` matches the agreed layout. It would also match any
  future app's folders, which is intended.

### `.node-version`

```
26.13.0
```

### `.gitignore`

```
# dependencies
node_modules/

# wrangler
.wrangler/
.dev.vars*

# build output
dist/
build/
.svelte-kit/

# playwright
test-results/
playwright-report/

# owner's local Claude Code config
.claude/
```

The reference's `.pgdata` lines are dropped: we have no database. If a
db slice arrives, it adds them back.

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2024"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

- **[detail]** `noEmit` and `allowImportingTsExtensions`: nothing in
  the repo is built by tsc. Wrangler and Vite bundle, and the contract
  ships as source.
- **[detail]** `exactOptionalPropertyTypes` makes `field?` in the
  envelope mean "absent", not "present and undefined". The difference
  shows in the JSON.

## 3. Governance

### `AGENTS.md`

```markdown
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
```

- **[you]** The reference's opening paragraph describes an experiment
  repo, so I rewrote it. The Commands and Rules sections are byte for
  byte the reference's, since those are the profile output. One more
  sentence would point agents at `logbook/` as "not app code". I left
  it in because an agent reading `profile-notes.md` as instructions
  would be a finding.

### `.rsb/governance.lock`

```toml
# Governance lock for rsb-workers-hono-svelte. Written by hand at init:
# present and hashed, not validated.
#
# The profile nodes below (chain and mounts) are planned and not yet in
# agent-registry. Only the rules exist there today.

registry_rev = "eb8199f7dbc2eab856b2ab2d93f38b94069f64cc"

[root]
chain = ["base", "service", "pnpm-monorepo", "cloudflare", "rsb-workers-hono-svelte"]

[[mounts]]
path  = "apps/todo/api"
chain = ["hono-api", "hono-api-workers"]

[[mounts]]
path  = "apps/todo/web"
chain = ["svelte-bff", "svelte-bff-workers"]

[[mounts]]
path  = "apps/todo/contract"
chain = ["api-contract"]

[rules]
ids = ["rl-0009", "rl-0011", "rl-0012"]

[files]
"AGENTS.md" = "sha256:<computed at write>"
```

The repo leaf is named for this repo, following the reference.

### `.github/workflows/scorecard.yml`

This is the reference file with one change. **[detail]** The
Playwright loop becomes one step:
`pnpm --filter @todo/web exec playwright install --with-deps chromium`.
The loop was there because package names varied between agent runs.
Here they are fixed, and a loop that finds nothing passes silently.
Action SHAs are copied unchanged (rl-0011). The file never runs.

## 4. Logbook

### `logbook/README.md`

About fifteen lines: what the folder is (the lab record, never
produced by a mint), the tree from handoff 00, and the two entry
formats (profile-notes, findings), copied from the handoff's
Decisions.

**[detail]** The tree gains `drafts/YYYY-MM-DD-NN-<stage>[-<name>].md`,
numbered like the handoff the stage ends with: drafts are the record of
the draft step, which the workflow discussion needs as much as the
result.

### `logbook/findings/`

Empty. It gets a `.gitkeep` until slice 1 writes `01-health.md`.

### `logbook/profile-notes.md`: entries for init

Each entry has a kind, a statement, the lines that realize it, whether
a machine can check it, the slice, and a status. Paths:lines are
filled in at write.

| # | kind | statement | machine-checkable |
|---|---|---|---|
| P1 | rule | Node and pnpm are pinned exactly in `engines`, `packageManager` and `.node-version`, with engine-strict on | exact: parse three files, compare |
| P2 | rule | One root command per test tier, never bundled; `test` exits 1 and names them | exact: run `pnpm test`, expect exit 1 and the three names on stderr |
| P3 | template | Root `package.json` scripts: `dev`, `check`, `test:unit`, `test:integration`, `test:e2e`, `test` guard | exact: key set |
| P4 | rule | The API Worker is not public: `workers_dev: false`, `preview_urls: false`, no `routes` | exact: parse `wrangler.jsonc` |
| P5 | rule | The web reaches the API only through the `API` service binding | approximate: the binding exists in config; "only" needs an import or fetch scan (slice 1) |
| P6 | heuristic | The package name mirrors the path (`apps/todo/api` → `@todo/api`) | exact |
| P7 | heuristic | The contract ships as TS source (`exports` → `.ts`) with no build step | exact |
| P8 | rule | Tests sit in `test/unit/` and `test/integration/` per mount; e2e sits in `web/e2e/`; each config's `include` covers only its folder | exact: config globs against the tree |
| P9 | rule | The unit tier runs in the node environment with no Workers pool and no bindings | approximate: config check now; an import scan for adapters when adapters exist |
| P10 | heuristic | `passWithNoTests` exists only until a mount's first test, then it is removed | exact: flag absent once `test/` is non-empty |
| P11 | pattern | Shared tool versions live in the pnpm catalog; everything else is pinned exactly | exact |
| P12 | check (gap) | There is no debt baseline file (L4). Its format is open, so none is invented | no |
| P13 | rule | Workers binding types are generated (`wrangler types`) and verified by `check` (`wrangler types --check`) | exact |
| P14 | note | Toolchain pin coupling: Kit 3 requires TS ≤6 and the Workers vitest integration has been renamed | no: a version fact a mint must carry |
| P15 | pattern | Deliberate variants: where the lab compares two ways of doing one thing, both exist and each pair is listed here (first pair: filter in the BFF on `/`, filter in the API on `/active` and `/completed`, slice 8) | judgement: a reviewer or coherence check must read the list before flagging inconsistency |
| P16 | rule | Every API input is bounded: title 1–256 after trim, body ≤ 8 KiB (`too_large` 413, before parse), store ≤ 500 todos (`limit` 409) | approximate: limits exist as named constants in the contract; e2e and integration hit each boundary |
| P17 | rule | A limit is defined once in the contract and used by both BFF and API | approximate: no numeric literal for a limit outside `contract/` (scan) |
| P18 | rule (candidate) | No `{@html}`; SvelteKit's form-action origin check stays on; `internal` errors never carry the cause | exact: grep for `{@html}` and for `csrf` config; approximate for the message |
| P19 | pattern (open) | Ways a page reaches the API: form actions (this iteration), remote functions (`query`, `command`, `form`), `+server.ts` endpoints with client `fetch`, load-only reads, streamed load. One example of each in a later iteration | no: not built yet |

**[you]** P4 and P5 together are the "API not public" constraint. I
split them because P4 is fully exact and P5 isn't yet.

## 5. Spec: `prd/todo.md`

### S1–S5: agreed

- **S1** API surface as drafted.
- **S2** Both: `/` filters in the BFF; `/active` and `/completed` use
  `GET /todos?completed=` and `GET /todos/counts`. Recorded as a
  deliberate variant (P15) under the new catalogue constraint.
- **S3** Limits: title 1–256 after trim, body 8 KiB (`too_large` 413),
  store 500 todos (`limit` 409), under a new security constraint (P16,
  P17, P18).
- **S4** Form actions only this iteration; the catalogue of other
  request paths is a later one (P19, and handoff 01).
- **S5** Several scenarios per slice, each citing its upstream
  sentence or deviation.

### Shape of `prd/todo.md`

Headings follow `prd/echo.md` where they apply:

1. **Purpose.** This is the lab vehicle; behaviour matters less than
   flow.
2. **Source and licence.** TodoMVC `app-spec.md`, lines 80–122, at
   `tastejs/todomvc@ff43b02e59dfa604386bb382034b2cd07c2bcd8a`, MIT,
   with the full copyright notice (`license.md` at the same commit:
   Addy Osmani, Sindre Sorhus, Pascal Hartig, Stephen Sawchuk).
   Todo-Backend `9fdf6f9` is cited only, with the note that it has no
   licence.
3. **Functionality (verbatim upstream).** Lines 80–122 unchanged
   (already fetched; I checked that they start at `## Functionality`
   and end at the Routing paragraph). The headings are demoted one
   level so that they sit under this section.
4. **Deviations.** One per line, each with its constraint:
   - envelope (fixed input);
   - API not public, so no CORS and no `url` (fixed input);
   - persisted in the API's in-memory store, so todos survive a reload
     but not a restart, instead of localStorage (data fixed input);
   - real routes `/`, `/active`, `/completed` instead of hash routes
     and Flatiron Director (SvelteKit routing is "the framework's
     built-in capabilities", which upstream prefers; the active filter
     persists on reload because it is the URL);
   - DOM selectors (`#main`, `#footer`, `.destroy`, `<strong>`,
     `.editing`, `.completed`, `selected`) are dropped and the
     behaviour is kept (e2e uses roles and labels);
   - "Hovering shows the remove button": the button is always present
     in the DOM, and hover only changes its visibility. Behaviour is
     kept and e2e clicks it;
   - health (ours);
   - the `internal` kind (ours, for the error handler).
5. **API** (S1), **Envelope** (from the handoff, with `internal`).
6. **Shape**: the stack lines from the fixed inputs.
7. **Out of scope**: deploy, sign-in, a database (until you decide),
   concurrency.

The full text is in `logbook/drafts/2026-10-30-01-prd-todo.md`. It also adds Constraints
(C-fixed, C-catalogue, C-secure), Security, Slices and Acceptance
scenarios sections, and the deviations list grows to 14.

## 6. App folders (configured, no source)

### `apps/todo/contract/`

`package.json`:
```json
{
  "name": "@todo/contract",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "check": "tsc -p tsconfig.json",
    "test:unit": "vitest run -c vitest.unit.config.ts"
  },
  "dependencies": { "valibot": "catalog:" },
  "devDependencies": { "typescript": "catalog:", "vitest": "catalog:" }
}
```
`tsconfig.json`: extends the base, with `include: ["src", "test", "*.config.ts"]`.
`vitest.unit.config.ts`: `environment: "node"`, `include: ["test/unit/**/*.test.ts"]`, `passWithNoTests: true` (P10).

**[detail]** The `*.config.ts` include does real work. With no `src/`
files, tsc fails with TS18003 "No inputs were found". The config file
is an input, so `check` passes before slice 1 without a placeholder
source file. It also type-checks the configs.

### `apps/todo/api/`

`package.json`: `@todo/api`, with scripts:
- `dev`: `wrangler dev`
- `check`: `wrangler types --check && tsc -p tsconfig.json`
- `test:unit`: `vitest run -c vitest.unit.config.ts`
- `test:integration`: `vitest run -c vitest.integration.config.ts`
- `types`: `wrangler types`

Dependencies: `@todo/contract: workspace:*`, `hono`,
`@hono/valibot-validator`, `valibot: catalog:`. Dev dependencies:
`typescript`, `vitest`, `wrangler`, `@cloudflare/vitest-plugin`.

`wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "todo-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-30",
  // Not public: reachable only through the web Worker's service binding.
  "workers_dev": false,
  "preview_urls": false
}
```

`worker-configuration.d.ts` is generated and committed, so `check` can
verify it (P13).

`tsconfig.json`: base, plus `types: ["./worker-configuration.d.ts"]`,
and the same include as contract.

`vitest.unit.config.ts`: node environment, `test/unit/**`,
`passWithNoTests`. The unit tier does not use the Workers runtime;
that is what P9 checks.

`vitest.integration.config.ts`:
```ts
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: { include: ["test/integration/**/*.test.ts"], passWithNoTests: true },
});
```
The exact plugin call is checked against the package's types at write.

### `apps/todo/web/`

`package.json`: `@todo/web`, with scripts:
- `dev`: `vite dev`
- `build`: `vite build`
- `check`: `wrangler types --check && svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`
- `test:unit`: `vitest run -c vitest.unit.config.ts`
- `test:e2e`: `playwright test`

Dependencies: `@todo/contract`. Dev dependencies: kit, svelte,
vite-plugin-svelte, adapter-cloudflare, vite, svelte-check,
typescript, vitest, wrangler, `@playwright/test`, `@types/node`.

`wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "todo-web",
  "main": ".svelte-kit/cloudflare/_worker.js",
  "compatibility_date": "2026-10-30",
  "assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
  // The only way to the API.
  "services": [{ "binding": "API", "service": "todo-api" }]
}
```

`svelte.config.js`: `adapter-cloudflare()`, `vitePreprocess()`.
`vite.config.ts`: `sveltekit()`. `tsconfig.json`: extends
`./.svelte-kit/tsconfig.json`, as SvelteKit requires. The repo base
can't also be extended unless I use TS's array `extends`, so I'll use
`extends: ["../../../tsconfig.base.json", "./.svelte-kit/tsconfig.json"]`.
I'll check that svelte-check accepts it.

`vitest.unit.config.ts`: node environment, `test/unit/**`,
`passWithNoTests`. Slice 1's stub-binding test of the page load lives
here.

`playwright.config.ts`: `testDir: "e2e"`, chromium only, and two
`webServer` entries (L3's cross-mount reference): the api's
`wrangler dev` and the web's `vite dev`, each with a ready URL.

- **[you]** `test:e2e` on empty: Playwright has `--pass-with-no-tests`,
  but it may still start `webServer` first. If it does, it fails until
  slice 1, because the api has no `src/index.ts`. Two options:
  (a) `--pass-with-no-tests`, and if the servers start anyway, stub
  only `test:e2e` (`echo "no e2e scenarios yet"`) until slice 1;
  (b) stub all of `test:*` until slice 1. I recommend (a) with
  `passWithNoTests` for unit and integration: the commands, configs
  and include globs are then exercised from init, and P10 says when
  the flag goes.

## 7. Write order and checks

1. Root files, then `pnpm install` (~/.local/share/pnpm/bin/pnpm).
2. Mounts, then `pnpm install` again, and `pnpm types` in api and web.
3. Run `pnpm check`, `pnpm test`, and each `test:*`, showing the
   output.
4. Logbook, PRD, AGENTS.md hash into the lockfile.
5. One local commit after your review, staged by explicit path.
   Then handoff 01 and the branch for your PR.

## Your decisions, collected

- ~~the `dev` mode (§2)~~ agreed: both Workers in parallel
- ~~the extra AGENTS.md sentence (§3)~~ agreed
- ~~the P4/P5 split (§4)~~ agreed
- ~~`test:e2e` on empty (§6)~~ agreed: option (a)

## 8. Changed at write

The sections above are the draft as reviewed. Writing it changed:

1. **Kit 3.1.1 → 3.1.0, adapter-cloudflare 8.0.2 → 8.0.1.** Both were
   published the day before, inside pnpm 12's release-age gate. pnpm
   then wrote `minimumReleaseAgeExclude` for them into
   `pnpm-workspace.yaml` by itself. I removed that and pinned the
   previous releases (two weeks old), which keeps the gate (P20).
2. **`allowBuilds` for esbuild and workerd.** pnpm 12 refuses to install
   while a build script is unapproved (P21).
3. **No `svelte.config.js`.** Kit 3 rejects it; the config is flat in
   `sveltekit({ adapter, preprocess })` in `vite.config.ts` (P22).
4. **Web `tsconfig.json` extends `$app/tsconfig`**, not
   `./.svelte-kit/tsconfig.json`; the array with the repo base is
   accepted, and `types` keeps `$app/types` (P22).
5. **`src/app.html` exists at init.** `svelte-kit sync` fails without
   it. It is Kit's minimal template, not app code.
6. **Web `test:e2e` is a placeholder.** Playwright started both
   `webServer` entries with no tests, and `wrangler dev` failed on the
   missing `src/index.ts`, so option (a)'s fallback applies (P24).
7. **Telemetry left open.** `send_metrics: false` did not stop
   `wrangler types` calling `sparrow.cloudflare.com` (the sandbox
   denied it); only the env var does. Reverted; recorded as P23.
8. **pnpm store.** In this sandbox pnpm puts its store at
   `node_modules/.pnpm-store`, which is ignored; nothing to commit.
9. **valibot instead of zod** (owner, at review). The profile's
   validation library is valibot: valibot 1.5.0 in the catalog,
   `@hono/valibot-validator` 0.6.2 in api. Both pass the release-age
   gate with no exclusion. zod 4.6.6 stays in the lockfile only as a
   dependency of `@cloudflare/vitest-plugin` (dev, integration tier);
   no mount depends on it (P25).
