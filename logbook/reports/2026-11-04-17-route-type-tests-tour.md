# Review tour: stage 17 (keeping the route's type refusals), 2026-11-04

Claude wrote this tour of stage 17 for the owner to review against the
code. It is a written tour; nobody led it live. Stage 17 commits a type
test for the route helpers and the route table. Stages 13 and 16 had
each checked these refusals once, by hand; now `pnpm check` fails if
any one of them stops refusing.

The branch is `test/route-types`, made from `main` at `8806e3a`, the
merge of PR #37, which holds stage 16's `a65bd2e`. It has three
commits:
- `ee70ec4` `refactor(api)`: `route` and `probe` move into `route.ts`.
- `49402c8` `test(api)`: the type test, `apps/api/test/types/routes.ts`.
- the third, `docs(logbook)`: the story, the profile notes, handoff
  12's backlog row, this tour and handoff 17.

Checks after `49402c8`, each in a fresh command:
- `pnpm check` exits 0, and it compiles the type test.
- `pnpm check:api`, `pnpm check:entry-chains` and `pnpm check:rules`
  exit 0.
- `pnpm test:tooling`: 155 pass.
- `pnpm test:unit`: every package passes. `valid` has 57 and
  `apps/api` has 59.
- `pnpm check:join`, run after `test:unit`, exits 0.
- `pnpm test:integration`: 29 pass.
- `pnpm test:e2e`: 41 pass.

No count moved. A type test is compiled, not run, and vitest does not
collect a file without `.test.` in its name. `apps/api` still runs 10
files.

"Why" cites handoff 17's questions and the owner's answers:

| Question | Owner's answer |
|---|---|
| Q1, how the test reaches `route` | Move `route` and `probe` into their own module in the composition zone, imported by construct and by the test. Construct keeps only the table the two readers scan; re-run `check:entry-chains` and `check:join` to prove they still read it. The CLI's `constructCommands` can import it later |
| Q2, where the file lives | `apps/api/test/types/routes.ts`, with no `.test.` in the name; confirm the api's tsconfig includes `test/` |
| Q3, which refusals | All six: the two stage 13 claims are the kind that loosen silently, and a type test is the only place they are asserted |
| Q4, type-checking `tooling/` | A separate stage, added to handoff 12's backlog as its own row |
| Proofs | Before commit 2, show a deleted `@ts-expect-error` and a loosened overload failing, as `tsc` output |

## 1. The route helpers' own module

Commit `ee70ec4`: `apps/api/src/route.ts`, `apps/api/src/construct.ts`.

- **What:**
  - `route.ts` holds `route`, `probe` and their private helpers,
    `named`, `Same`, `UnitsTyped`, `Runs` and `Builds`. It sits in the
    composition zone, beside `http.ts`.
  - `construct.ts` binds the helpers with
    `const { route, probe } = routing<Operations>();` and keeps its
    builders and the table. The table's lines are byte for byte the
    same.
- **Changed beyond the answer:** the module is a factory,
  `routing<O>()`, generic over the operations record. A plain move
  would have bound it to construct's `Operations`. I did this for
  three reasons:
  - Row 5's second case, "another operation has the same type", can
    only be shown by binding the helpers to a record where two
    operations share a type. No two of ours do.
  - `route.ts` imports nothing from construct, so there is no import
    cycle.
  - The CLI's construct can bind the same helpers to its own
    operations.
  
  The cost is one call at module load. I flagged this before the
  commit, and the owner approved it.
- **The readers still read it:**
  - `check:entry-chains` and `check:api` exit 0 with every generated
    file unchanged.
  - `check:join` exits 0.
  - `routeLinesOf` reads only the lines inside `constructRoutes`'s
    `return {`, so the new module-level line is not one it parses.
  - `importsOf` reads `import { routing } from "./route.ts";` like any
    other import.
- **The error prefix stays `construct:`.** It still makes sense in a
  message thrown while construct runs, so I left it.

## 2. The type test

Commit `49402c8`: `apps/api/test/types/routes.ts`.

- **What:** three accepted calls, then eight refusals, each under a
  bare `@ts-expect-error`:

  | Row | Refused | Error with the directive stripped |
  |---|---|---|
  | 1 | `route({ postTodos }, { addTodo })` | too few arguments: the handler takes a validator |
  | 2 | `route({ postTodos }, { addTodo }, { toTodoPatch })` | the `rules` tuples differ |
  | 3 | `route({ getTodoCounts }, { countTodos }, { toNewTodo })` | the validator is not assignable to `never` |
  | 4 | `route({ postTodos }, { listTodos }, { toNewTodo })` | the `Runs` property is missing |
  | 5a | a handler taking `(n: number) => Promise<number>`, given `addTodo` | the `Runs` property is missing |
  | 5b | `postTodos` given `first` from `{ first: AddTodo; second: AddTodo }` | the `Runs` property is missing |
  | 6a | a `Routes` missing `DELETE /todos/{id}` | the property is missing |
  | 6b | a `Routes` with `GET /todos/{id}` | the property is unknown |

- **Accepted beside them:**
  - `route({ postTodos }, { addTodo }, { toNewTodo })`;
  - `route({ getTodoCounts }, { countTodos })`;
  - `probe({ getHealth })`;
  - for row 5b, the same call bound to `{ first: AddTodo }` alone;
  - for row 6, a full `Routes`.
  
  A helper that refuses everything therefore fails too.
- **Each refusal is for its own reason.** I stripped every directive
  and compiled. `tsc` reported one error per refusal, each the one in
  the table, so none passes because of some unrelated error. The
  directives stay bare, without a reason written after them, because
  the comment above each row says what it refuses.
- **Values without running:** `operations` and the route in row 6 are
  `declare const`, since the file is compiled and never run.
- **The proofs, shown to the owner before the commit,** each through
  `apps/api`'s `pnpm check` and then reverted:
  - Deleting row 2's directive made `pnpm check` fail with
    `test/types/routes.ts(32,37): error TS2322`, because `toTodoPatch`
    is not `toNewTodo`.
  - Loosening the overload's validator parameter in `route.ts` to
    `Record<string, Validator>` made `pnpm check` fail with
    `TS2578: Unused '@ts-expect-error' directive` at rows 2 and 3.
    Those two calls compiled once the parameter was loosened.
- **Compiled by:** `apps/api`'s `check` script is
  `wrangler types --check && tsc -p tsconfig.json`, and its `include`
  is `src`, `test` and `*.config.ts`. The required check runs
  `pnpm check`, so CI runs the test with no change to `scorecard.yml`.

## 3. Noted for the review

- **Only the api's helpers are covered.** The BFF has no route helper,
  so there is nothing of its own to test. The CLI's `constructCommands`
  would get its own type test when it binds `routing`.
- **The type test reads no spec.** Row 6 writes the eight endpoint
  keys out by hand. When an endpoint is added, `every` stops compiling
  until it gains the key. That is the intended failure, but it also
  means the file has to be edited with each endpoint.
- **`tooling/` is still not type-checked.** This is now row L of
  handoff 12's backlog (Q4), with no order set.

## 4. Story delta

Chapters changed:
- **0, Where the api lives:** the tree lists `route.ts`.
- **4, Construct:**
  - Construct's list builds each handler with its unit and its
    validator.
  - "The route table is data" says where the helpers live, how
    construct binds them, and that the CLI can bind them too. Its
    example now uses the stage 16 form; the old two-argument
    `postTodos` call no longer compiles.
  - A new bullet, "The refusals are kept", names the type test and
    what it refuses.
- **5, Entry points:** the L33 bullet says the type test keeps the
  validator refusals.

Also changed:
- **Profile notes:**
  - P54 and P55 cite the type test in their checks, and both now cite
    stages 13 and 17.
  - P55's file is `route.ts`, bound in `construct.ts`.
  - P62's check names the refusals the type test keeps.
- **Handoff 12:** row L, "`tooling/` is type-checked".

Not changed:
- Chapters 1–3 and 6–13. None of them describes the route helpers or
  where they live.
- Chapter 9's index rows, which name `construct.ts` for the route, as
  the generated index still does.
- The glossary, which has no entry for the helpers.
