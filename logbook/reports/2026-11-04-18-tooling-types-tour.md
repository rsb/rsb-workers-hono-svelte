# Review tour: stage 18 (`tooling/` is type-checked), 2026-11-04

Claude wrote this tour of stage 18 for the owner to review against the
code. It is a written tour; nobody led it live. Stage 18 makes
`tooling/` a workspace package, so `pnpm check` compiles the
generators and checkers with their tests. Before, Node ran them with
the types stripped, and nothing compiled them.

The branch is `build/tooling-types`, made from `main` at `c02cef7`, the
merge of PR #39, which holds `01dc63f`. It has three commits:
- `639b2a9` `test(tooling)`: the stale fixture, fixed alone.
- `194d666` `build(tooling)`: the package, its tsconfig, the workspace
  entry and the lockfile.
- the third, `docs(logbook)`: this tour, handoff 12's backlog, the
  story, the glossary, the profile notes and handoff 18.

Checks after `194d666`, each in a fresh command:
- `pnpm check` exits 0. `@todo/tooling`'s `check` runs in it.
- `pnpm check:api`, `pnpm check:entry-chains` and `pnpm check:rules`
  exit 0.
- `pnpm test:tooling`: 155 pass.
- `pnpm test:unit`: every package passes. `valid` has 57 and
  `apps/api` has 59.
- `pnpm check:join`, run after `test:unit`, exits 0.
- `pnpm test:integration`: 29 pass.
- `pnpm test:e2e`: 41 pass.

No count moved. Compiling adds no runner test, and
`node --test tooling/` does not collect anything from
`tooling/node_modules`.

"Why" cites handoff 18's questions and the owner's answers:

| Question | Owner's answer |
|---|---|
| Q1, package or bare tsconfig | (a): a private `@todo/tooling` with its own `check`, added to the workspace. The root scripts stay where they are |
| Q2, dependencies | `typescript` from the catalog and `@types/node` pinned to `26.6.6`, in `tooling/` only. "`@types/node` in the catalog" becomes a backlog row in handoff 12, not part of this stage |
| Q3, the tests | Included, all 14 test files |
| Q4, the fixture | `validator: null`, written out. The point of the stage is that the next required field breaks loudly |
| `pnpm install` | Claude gives the command and stops; the owner runs it |
| The join's report staleness | Out of this stage, as its own row |

## 1. The stale fixture

Commit `639b2a9`: `tooling/api-spec/emit-openapi.test.ts`.

- **What:** the extra route in "refuses a route the spec does not
  list" gains `validator: null`.
- **Why it was stale:** stage 16 made `RouteRow.validator` required
  (`tooling/entry-chains/routes.ts:24`). The test kept passing, because
  it checks only that `emitOpenApi` refuses the route, and nothing
  compiled the file.
- **Written out, not spread (Q4):** a spread from a real row would
  absorb the next required field silently. A spread also needs a `!` or
  a guard, because `routes[0]` is `RouteRow | undefined` under
  `noUncheckedIndexedAccess`.
- **Line:** handoff 18's trial `tsc` output gave line 113. The fixture
  is on line 112. Nothing else in the file needed a change.

## 2. The package

Commit `194d666`: `tooling/package.json`, `tooling/tsconfig.json`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`.

- **What:**
  - `tooling/package.json`: `@todo/tooling`, private, `type: module`.
    It has one script, `"check": "tsc -p tsconfig.json"`, and two dev
    dependencies, `@types/node` `26.6.6` and `typescript` `catalog:`.
    It has no `exports`, since nothing imports it.
  - `tooling/tsconfig.json`: extends `../tsconfig.base.json`, adds
    `"types": ["node"]`, and includes `**/*.ts`, so the 14 tests are
    compiled with the 17 scripts.
  - `pnpm-workspace.yaml`: `tooling` added after `packages/data/*`.
  - `pnpm-lock.yaml`: one new importer, `tooling`, with the two dev
    dependencies. The owner ran `pnpm install`. It resolved nothing
    new, because `apps/bff` and the catalog already held both versions.
- **What did not change:**
  - The root `check` is still `pnpm -r check`, and it picks the
    package up.
  - `scorecard.yml` runs `pnpm check`, so CI compiles `tooling/` with
    no change to the workflow (rl-0009).
  - `gen:*`, `check:*` and `test:tooling` stay in the root
    `package.json` and still run `node tooling/....ts`. Node still
    strips the types at run time; the compile is a separate check.
  - `test:unit` and `test:integration` run with `--if-present`, so the
    package, which has neither script, adds nothing to them.
- **The proof, shown to the owner before the commit:**
  - I removed `?? ""` from `namedBy` in `tooling/join/join.ts:36`.
    That leaves `head` as `string | undefined`, which Node's type
    stripping would still run.
  - `pnpm check` failed:

    ```
    tooling check: join/join.ts(37,47): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
      Type 'undefined' is not assignable to type 'string'.
    tooling check: Failed
    ```

  - I restored the file from a copy; `git diff` on it was empty.
    `pnpm check` then exited 0 across every package.

## 3. Noted for the review

- **Two exact pins of `@types/node`.** `apps/bff` and `tooling/` each
  pin `26.6.6`. Moving it into the catalog would edit `apps/bff`, so it
  is now row M of handoff 12's backlog.
- **The join's unit report** is still checked for staleness against
  the test files only, not against `packages/operations/src`. It is
  now row N.
- **`tooling/` is a workspace but not a package in the story's sense.**
  Chapter 0 has two kinds of workspace, apps and packages. `tooling/`
  is neither: nothing depends on it, and it exists in the workspace
  only to be compiled. Chapter 0 now says so, and does not add a
  third kind.
- **The base config fits Node scripts.** `tsconfig.base.json`'s
  `moduleResolution: "bundler"` and `allowImportingTsExtensions` accept
  the scripts' `./x.ts` imports and `node:` built-ins as they are, so
  `tooling/tsconfig.json` overrides only `types`.
- **The wrangler telemetry** that `apps/api` and `apps/bff`'s `check`
  try to send was refused by the sandbox. It has no effect on the
  result.

## 4. Story delta

Chapters changed:
- **0, Where the api lives:** a paragraph after the workspace layout
  says `tooling/` is a workspace since stage 18, though neither an app
  nor a package, and why.
- **11, Contracts:** the paragraph on what the scorecard runs adds
  that `pnpm check` compiles `tooling/` since stage 18, and what went
  unnoticed before.

Also changed:
- **Glossary:** the `tooling/` entry no longer says "with no
  dependencies, outside the workspace". It names the package and its
  two dependencies.
- **Profile notes:** P65, the generators and checkers are compiled.
- **Handoff 12:**
  - row L is marked done, stage 18;
  - row M, `@types/node` in the catalog, is added;
  - row N, the join's report staleness against
    `packages/operations/src`, is added.

Not changed:
- Chapters 1–10, 12 and 13. None of them describes how `tooling/` is
  built or checked.
- P59, which names the scorecard's steps. The steps did not change.
