# Review tour: stage 19 (the join's report is stale when the code is), 2026-11-04

Claude wrote this tour of stage 19 for the owner to review against the
code. It is a written tour; nobody led it live. Stage 19 does handoff
12's rows N and M, in that order:
- N: `pnpm check:join` refuses the operations unit report when the
  code the tests ran is newer than it, not only when the tests are.
- M: `@types/node` comes from the catalog.

The branch is `fix/join-staleness`, made from `main` at `df3522f`, the
merge of PR #40. It has three commits:
- `28162d1` `fix(tooling)`: N. `readReport`, `check.ts`, the root
  script and the tests.
- `6879b7a` `build(deps)`: M. The catalog, the two packages and the
  lockfile.
- the third, `docs(logbook)`: this tour, handoff 12's rows A, M and N,
  the story, the glossary and handoff 19.

Checks after `6879b7a`, each in a fresh command:
- `pnpm check` exits 0.
- `pnpm check:api`, `pnpm check:entry-chains` and `pnpm check:rules`
  exit 0.
- `pnpm test:tooling`: 159 pass.
- `pnpm test:unit`: every package passes. `valid` has 57 and
  `apps/api` has 59.
- `pnpm check:join`, run after `test:unit`, exits 0.
- `pnpm test:integration`: 29 pass.
- `pnpm test:e2e`: 41 pass.

Only the tooling count moved, from 155 to 159, by the four new
`readReport` cases. Handoff 19 expected one new case. The other three
cover what the derivation the owner asked for (Q1) adds: a
dependency's source file, a report newer than everything it watches,
and a dependency that is not linked.

"Why" cites handoff 19's questions and the owner's answers:

| Question | Owner's answer |
|---|---|
| Q1, which sources are watched | (b), but derived: `packages/operations/src` plus the `src` of every workspace package operations' `package.json` lists, so a new dependency is watched the day it is added and the root script names one package. Hardcode (b) only if deriving costs more than an hour; it did not |
| Q2, how `check:join` takes them | (a): any number of directories after the report, no fixed positions |
| Q3, the vitest config and `package.json` | No. The config changes what runs, and a missing named test is already refused |
| Q4, M's place | The same branch, `build(deps)` after N, with the owner's `pnpm install` between |
| The glossary | Its `tooling/` entry is fixed; the stage 18 tour stays as it was |

## 1. The report is checked against the code it tested

Commit `28162d1`: `tooling/join/report.ts`, `tooling/join/check.ts`,
`tooling/join/report.test.ts`, `tooling/join/check.test.ts`, the root
`package.json`.

- **What:**
  - `readReport(reportPath, watched, run)`
    (`tooling/join/report.ts:61`) takes a list of directories instead
    of one tests directory. It refuses the report when any file they
    cover is newer than it. The message has the same form as before
    and names every newer file.
  - `watchedDirs` (`tooling/join/report.ts:35`) says what one
    directory covers:
    - a plain directory is watched whole;
    - a directory holding a `package.json` stands for its package:
      its `src/`, then the `src/` of each dependency whose specifier
      starts `workspace:` (line 42), from `dependencies` and
      `devDependencies` alike.
  - `check.ts` takes every argument after the report as a watched
    directory (`tooling/join/check.ts:30`). It prints the usage and
    exits 2 when there are none. The usage line ends
    `<unit report> <watched dir>...`.
  - The root `check:join` ends
    `… unit.json packages/operations/test/unit packages/operations`.
    `check.test.ts` runs the same arguments.
- **Why derived, not listed (Q1):** the root script names one package.
  `packages/business/src` and `packages/fail/src` come from
  operations' `package.json`, and a dependency added there is watched
  with no change to the script.
- **How a dependency is found:** through the package's own
  `node_modules/<name>`, the link pnpm makes, resolved with
  `realpathSync` and named relative to the repo root (line 51). So the
  join does not read `pnpm-workspace.yaml` or its globs. A dependency
  with no link refuses the report:
  `<pkg>/package.json: <name> is not linked; run pnpm install`
  (line 49).
- **Why one rule (Q2):** the join does not know which directory holds
  tests and which holds code. The tests directory is a plain directory,
  and the package is a package.
- **The tests** (`tooling/join/report.test.ts`): the scratch directory
  is now a package, `ops`, with a test file and a source file. It
  depends on a sibling, `dep`, linked under `node_modules/@todo/` as
  pnpm links it, plus a `catalog:` dependency that must be ignored.
  Every file starts at time 1000. The new cases:
  - a source file of the package newer than the report (line 87);
  - a source file of the dependency newer than it (line 98);
  - a report newer than all of them is read (line 110);
  - a dependency that is not linked (line 118).

  The four earlier cases pass `[tests]`, and are otherwise unchanged.
- **The proof, shown to the owner before the commit:**
  - after `pnpm test:unit`, `pnpm check:join` exited 0;
  - I touched `packages/business/src/rules.ts`; `check:join` exited 1:

    ```
    packages/operations/test-results/unit.json: older than packages/business/src/rules.ts; run pnpm test:unit again
    ```

  - I touched `packages/operations/src/todos/add-todo.ts` and
    `packages/fail/src/fail.ts` too; the message named all three:

    ```
    packages/operations/test-results/unit.json: older than packages/operations/src/todos/add-todo.ts, packages/business/src/rules.ts, packages/fail/src/fail.ts; run pnpm test:unit again
    ```

  - `pnpm test:unit` passed, and `check:join` exited 0 again.
  - `touch` changes only the mtime, so no file's content changed.
- **What did not change:** the vitest config and `package.json` of
  operations are not watched (Q3). CI is as it was: the scorecard runs
  `test:unit` before `check:join` on a fresh checkout, so the report is
  always newer there. The fix is for local runs.

## 2. `@types/node` in the catalog

Commit `6879b7a`: `pnpm-workspace.yaml`, `apps/bff/package.json`,
`tooling/package.json`, `pnpm-lock.yaml`.

- **What:**
  - `pnpm-workspace.yaml`'s `catalog:` gains `"@types/node": 26.6.6`,
    first in sorted order. The key is quoted because YAML does not
    start a plain key with `@`.
  - `apps/bff` and `tooling/` ask for `"@types/node": "catalog:"`.
  - `pnpm-lock.yaml`, by the owner's `pnpm install`: the catalogs
    section gains the entry, and the two importers' specifier becomes
    `'catalog:'`, still at version `26.6.6`. Nothing else changed.
- **Why:** two exact pins of the same types could drift apart. P11
  already says shared tool versions live in the catalog.
- **Nothing new resolved.** The install's output said `+113` and
  `downloaded 20`. The lockfile did not move, so those numbers are
  pnpm relinking `node_modules`, not new versions.

## 3. Noted for the review

- **Dependencies are followed one step.** Business and fail import
  nothing of ours, so one step covers everything the operations tests
  run today. If business gains a workspace dependency, its code is not
  watched until the rule follows dependencies further. That is the
  drift left. Following the whole graph is a loop over the same
  `package.json` read, with a guard against cycles.
- **`devDependencies` are followed too.** A workspace devDependency
  would be code the tests run, a test helper for example. Operations
  has none today, so this changes nothing yet.
- **The convention is `src/`.** A package stands for its `src/`, which
  is where every package here keeps its code and what each one
  exports. A package laid out otherwise would be watched wrongly, and
  silently.
- **The watch is by mtime.** A checkout, a branch switch or a `touch`
  can make the report look stale when nothing changed. That costs one
  `pnpm test:unit`, and never lets a stale report through.
- **P11's source is stale.** It cites `pnpm-workspace.yaml:6,13-17`.
  The catalog is lines 16–21 now, and it was 16–20 before this stage.
  The note was not changed; a source that names the catalog, not its
  lines, would stop drifting.
- **No decision was recorded.** The derivation applies L33 (the join
  never runs a tier and reads the report) and refines what "older than
  the tests" meant. L36 stays free.
- **The wrangler telemetry** that `apps/api` and `apps/bff` try to send
  during `check` and e2e was refused by the sandbox. It has no effect
  on the result.

## 4. Story delta

Chapters changed:
- **11, Contracts:** the join paragraph says what the report is checked
  against since stage 19: the operations tests, `packages/operations/src`,
  and each workspace dependency's `src/`, read from its
  `package.json`, so today business and fail.

Also changed:
- **Glossary:** the `tooling/` entry says both its dependencies come
  from the catalog.
- **Handoff 12:** rows A (stage 13), M and N (stage 19) are marked
  done.

Not changed:
- Chapters 0–10, 12 and 13. None of them describes the join's report
  or the `@types/node` pin.
- The stage 16 and stage 18 tours. They say "older than the tests" and
  "pinned to `26.6.6`". Tours are a record and stay as they were.
- The profile notes. P11 already states the rule M applies.
