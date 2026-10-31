# Report: refactor A, the move, 2026-10-31

Claude did refactor A on branch `refactor/a-move`, as
[handoff 04](../handoffs/2026-10-31-04-slice-2-add-and-list.md) asks.
The code moved into the layout of
[the api story](../the-api-story.md), chapter 0. Behaviour did not
change. Tests changed only their import paths.

The owner approved two changes beyond the plain move: ignoring
`.pnpm-store/`, and updating the mount paths in `.rsb/governance.lock`.
The owner ran `pnpm install` in their own shell.

## 1. Result

The checks are the same before and after the move.

| Check | Baseline, main `89bdf8b` | After the move |
|---|---|---|
| `pnpm check` | passes; svelte-check: 518 files, 0 errors, 0 warnings | passes; svelte-check: 518 files, 0 errors, 0 warnings; `tsc` passes in all four packages |
| `test:unit` | 12 files, 43 tests | 12 files, 43 tests |
| `test:integration` | 6 files, 7 tests | 6 files, 7 tests |
| `test:e2e` | 9 passed | 9 passed |
| `pnpm test` | exits 1, on purpose | exits 1, on purpose |

Unit tests per package:

| Package | Before | After |
|---|---|---|
| contract | 2 files, 14 tests | `contract/api`: 2 files, 14 tests |
| web / bff | 4 files, 18 tests | `bff`: 4 files, 18 tests |
| api | 6 files, 11 tests | `api`: 3 files, 7 tests (handlers) |
| business | in the api | 1 file, 1 test |
| operations | in the api | 2 files, 3 tests |

The api's 6 test files are now split three ways: 3 stay in the api,
1 moved to business and 2 moved to operations. Their 11 tests are now
7 + 1 + 3.

The sandbox blocks the Cloudflare hosts `sparrow.cloudflare.com` and
`workers.cloudflare.com`, which wrangler uses for telemetry and update
checks. This made no difference to any result.

Not yet done: running `pnpm dev` by hand and adding a todo through the
BFF. The e2e suite covers this, but the owner has not tried it yet.

## 2. What moved

Every move used `git mv`, so git records each one as a rename and
keeps its history.

| Before | After | Package |
|---|---|---|
| `apps/todo/api` | `apps/api` | `@todo/api` |
| `apps/todo/web` | `apps/bff` | `@todo/bff` (was `@todo/web`) |
| `apps/todo/contract` | `packages/contract/api` | `@todo/contract-api` (was `@todo/contract`) |
| `api/src/app/business/{result.ts,todos/}` | `packages/business/src/` | `@todo/business` (new) |
| `api/src/app/operations/todos/` | `packages/operations/src/todos/` | `@todo/operations` (new) |
| `api/src/app/data/memory/todos.ts` | `packages/data/memory/src/todos.ts` | `@todo/data-memory` (new) |
| `api/test/unit/app/business/todos/` | `packages/business/test/unit/todos/` | |
| `api/test/unit/app/operations/todos/` | `packages/operations/test/unit/todos/` | |

What stayed where it was:

- The handlers, `construct.ts`, `http.ts` and `index.ts` stay in
  `apps/api`.
- The BFF's `lib/server/api/` stays in the BFF. Moving it to
  `packages/data/internal/api` is part of refactor B.

## 3. New packages

| Package | Depends on (ours) | Scripts | Files |
|---|---|---|---|
| `@todo/business` | nothing | `check`, `test:unit` | `package.json`, `tsconfig.json`, `vitest.unit.config.ts` |
| `@todo/operations` | `@todo/business` | `check`, `test:unit` | same three |
| `@todo/data-memory` | `@todo/business` | `check` | `package.json`, `tsconfig.json` |

- Each package exports `"./*": "./src/*"`. An import therefore names
  the exact file it reaches, for example
  `@todo/business/todos/todo.ts`. There is no barrel file.
- Each tsconfig extends the root `tsconfig.base.json` and includes
  only `src`.
- `data-memory` has no tests, because it had none before the move.

## 4. Dependencies between packages (chapter 9)

- `business` depends on nothing of ours.
- `operations` and `data-memory` depend on `business`.
- `api` depends on `contract-api`, `business`, `operations` and
  `data-memory`. It needs `data-memory` because `construct.ts` builds
  the store.
- `bff` depends only on `contract-api`.

These are now declared in each `package.json`, so the workspace
enforces them. Before, they were relative paths inside one package.

## 5. Source edits

The only source edits are imports:

- **Contract:** every `"@todo/contract"` import became
  `"@todo/contract-api"`.
- **Code that crossed the new package boundary:** relative imports
  became package imports.
  - `construct.ts`: the store and the operations. Package imports are
    now grouped first.
  - `handlers/validate.ts` and `handlers/todos/present.ts` import
    from `@todo/business/...`.
  - `handlers/todos/{get-todos,post-todos}.ts` import from
    `@todo/operations/...`.
  - The operations sources and the memory store import from
    `@todo/business/...`.

Test edits, all of them import paths only:

- `apps/api/test/unit/app/handlers/todos/post-todos.test.ts` now
  imports from `@todo/business` and `@todo/operations`.
- The business and operations tests import their own package
  relatively, for example `../../../src/todos/todo.ts`. The
  operations tests import `Todo` from `@todo/business`.
- In the api, bff and contract tests, only the contract import name
  changed.

None of the 33 renames without edits changed content. These include
every `.svelte` file, both e2e tests and all the contract sources.

## 6. Config and wiring

| File | Change |
|---|---|
| `pnpm-workspace.yaml` | Globs went from `apps/*/*` to `apps/*`, `packages/*`, `packages/contract/*` and `packages/data/*` |
| `package.json` (root) | `dev` filters `./apps/*`; `test:e2e` filters `@todo/bff` |
| `apps/{api,bff}/tsconfig.json` | `extends` is one level shorter |
| `apps/bff/wrangler.jsonc` | Worker name changed from `todo-web` to `todo-bff` |
| `apps/api/wrangler.jsonc` | Comment says "BFF Worker's" instead of "web Worker's" |
| `.github/workflows/scorecard.yml` | Playwright install filter is now `@todo/bff`; SHA pins and permissions unchanged (rl-0011) |
| `.rsb/governance.lock` | Mounts are now `apps/api`, `apps/bff` and `packages/contract/api` (owner approved) |
| `README.md` | Layout tree rewritten; "web" became "BFF" |
| `.gitignore` | Ignores `.pnpm-store/`, committed separately (owner approved) |
| `pnpm-lock.yaml` | Rewritten by the owner's `pnpm install`; importers follow the new paths |

`worker-configuration.d.ts` is unchanged in both apps. `pnpm check`
runs `wrangler types` and reports that the types are up to date. The
BFF's binding is still `API: Fetcher /* todo-api */`.

## 7. Findings

1. **Worker names.**
   - The api Worker stays `todo-api`. The PRD names it, and the BFF's
     service binding and the `https://todo-api/...` URLs use it.
   - The BFF Worker changed from `todo-web` to `todo-bff`, to match
     its directory.
   - Worker names share the Cloudflare account's namespace, so they
     keep the `todo-` prefix. The "no product namespace" rule (A9)
     applies inside the repo, not to the account.
   - The npm scope `@todo/` is unchanged.

   This decision is worth recording for the profile.
2. **`governance.lock` mounts.**
   - Updated with the owner's approval.
   - The lock hashes only `AGENTS.md`, so rl-0009 was not involved.
   - The three new packages (business, operations, data/memory) have
     no profile mount. The profile has to decide what governs them.
3. **The PRD still describes the old layout.** `prd/todo.md:196`
   says "`apps/todo/` holds `api` … `web`", and line 150 names
   `todo-api`. The PRD is a fixed input, so it was not edited.
4. **Leftover `apps/todo/`.** It holds only an ignored
   `.claude/.cc-writes` directory. Git does not see it, and it is left
   for the owner to delete.
5. **e2e count.** The slice 2 findings say "8 of 8" e2e. The baseline
   ran 9: the 8 add-and-list scenarios (2.1–2.8) plus the health test.
   Most likely the 8 counted only the slice 2 scenarios.
6. **Export pattern.** `"./*": "./src/*"` keeps file-level imports,
   where an import shows the file it reaches, without a barrel file. The
   contract package keeps its single `"."` export, because it is a
   published surface, not a set of internals. The profile should
   choose one of these patterns, or both on purpose.

## 8. Still to do

- The owner tries `pnpm dev` and adds a todo through the BFF.
- Logbook:
  - The api story: rewrite the "Paths are under `apps/todo/api/src/`"
    line and the "Today this is …" table in chapter 0 to the present
    tense.
  - Mark refactor A done.
  - The slice 2 decisions draft: point its layout note at the story.
  - Carry findings 1–6 into `findings/`.
- Commits, local only (the owner pushes):
  - a `refactor:` commit for the move;
  - a `docs(logbook):` commit for this report and the logbook updates.
- Handoff 05, then refactor B.
