# Review tour: stage 21 (budgets per entry chain), 2026-11-04

Claude wrote this tour of stage 21 for the owner to review against the
code. It is a written tour; nobody led it live. Stage 21 does handoff
12's row C. A budget is the most round trips a unit makes to the level
below it, written as a number, with a cheap-tier test that fails when
the code spends a different amount. It gives L11 ("performance is a
design input") the sensor it lacked. Before this stage, a second store
call in an operation, or a third statement in a store method, passed
every test.

The branch is `test/budgets`, made from `main` at `d3e9b32`:
- `d7c2b02` `test(data)`: `fakeD1` records trips, and the data budgets.
- `735f3eb` `test(api)`: the shared fake store, its counting wrapper,
  and the api budgets.
- `7379e68` `test(bff)`: the counting binding and the BFF budgets.
- then the `docs(logbook)` commit: this tour, handoff 12's row C, the
  story, P67 and handoff 21.

Checks after `7379e68`, each in a fresh command:
- `pnpm check` exits 0.
- `pnpm check:api`, `pnpm check:entry-chains` and `pnpm check:rules`
  exit 0.
- `pnpm test:tooling`: 159 pass.
- `pnpm test:unit`: every package passes. `valid` has 57.
- `pnpm check:join`, run after `test:unit`, exits 0.
- `pnpm test:integration`: 46 pass, in 12 files.
- `pnpm test:e2e`: 41 pass.

Only the unit counts of the three budgeted packages moved, each by one
test per budgeted unit:

| Package | Before | After | Up by |
|---|---|---|---|
| `packages/data/d1` | 61 | 68 | 7, one per `DbStore` method |
| `apps/api` | 59 | 67 | 8, one per endpoint |
| `apps/bff` | 70 | 79 | 9, three loads and six actions |

No other count moved. No route, handler, port or data method changed,
so `entry-chains.md` was not regenerated, and `check:entry-chains`
passes as it was.

"Why" cites handoff 21's questions and the owner's answers:

| Question | Owner's answer |
|---|---|
| Q1, what the data level counts | Round trips to D1, with the batch's statement count beside them (`{ trips: 1, statements: 2 }`). "A round trip is the cost on a Worker, the statement count is the cost on D1" |
| Q2, where the numbers are written | One `budgets.test.ts` per level, in the package that owns the counter. The cross-level column in `entry-chains.md` is later; the data spec (row J) is the data level's eventual home |
| Q3, the api level's counter | A counting wrapper on the construct test's `fakeDbStore`, moved to a shared file, with each route sent one request through `constructRoutes` |
| Q4, the BFF level | The three page loads and the six actions, each counted alone. The reload after an action counts against the load |
| Q5, the existing count assertions | Leave them |
| Q6, a decision | Record L36 and P67 |

## 1. Data

Commit `d7c2b02`: `packages/data/d1/test/unit/fake-d1.ts`,
`packages/data/d1/test/unit/budgets.test.ts`.

- **What:**
  - `fakeD1` returns `trips` beside `prepared` and `batches`
    (`fake-d1.ts:25`). Each entry is one round trip, holding its
    statement count. `all` and `run` push 1 (lines 40, 47), and
    `batch` pushes its length (line 59).
  - `budgets.test.ts:22` is a `Record<keyof DbStore, Budget>`, where
    each entry holds its `{ trips, statements }`, the fake's answer,
    and the call. Each method is called once through `createDbStore`.
    The test sums the spend and compares it whole.
- **Why trips are counted at `all`, `run` and `batch`, not at
  `prepare` (Q1):** `prepare` and `bind` do no I/O. A batch's
  statements are prepared, but none of them calls `all` or `run`, so a
  batch is exactly one trip.
- **A trip is recorded even when D1 throws.** The call still went out.
  `batches` keeps its old order (recorded after the throw check), so
  `driver.test.ts`'s `batches` is `[]` assertion still means what it
  meant.
- **Only a success counts.** Each entry's answer is one the method
  succeeds on: `countTodos` gets its one row, and `updateTodo` gets the
  row it returns. A failed call can stop short of its cost, so a
  failure fails the test with "failed, so its cost was not measured".
- **The numbers:** `addTodoUnlessFull`, `listTodos`, `countTodos`,
  `updateTodo` and `deleteTodo` each make 1 trip of 1 statement.
  `setAllCompleted` and `deleteCompleted` each make 1 trip of 2. They
  match the handoff's reading of the source.
- **`listTodos` is called with a filter.** Its two branches each send
  one statement. The table holds one call per method, so the unfiltered
  branch is not budgeted on its own (section 4).
- **The existing `prepared` and `batches` assertions stay (Q5).** They
  prove which statements go out. The budget proves how many trips.
- **The proof,** shown to the owner before the commit:
  - with a second `selectTodosByCompletedRaw` in `listTodos`, the test
    failed with `listTodos: budget 1 trips of 1 statements, spent 2
    trips of 2 statements`, plus vitest's diff of the two objects;
  - with the `deleteCompleted` entry deleted, `tsc` failed with
    `TS2741: Property 'deleteCompleted' is missing`.

  Both files were restored byte for byte (`cmp`, `git diff --quiet`).

## 2. Api

Commit `735f3eb`: `apps/api/test/unit/fake-db-store.ts`,
`construct.test.ts`, `budgets.test.ts`.

- **What:**
  - The array-backed `fakeDbStore` moves out of `construct.test.ts`,
    unchanged, to `fake-db-store.ts`, which both tests import (Q3).
    `construct.test.ts`'s 8 tests are unchanged.
  - `countingDbStore` (`fake-db-store.ts:71`) wraps a store. Each
    method records its name in `calls`, then calls the store's method
    unchanged.
  - `budgets.test.ts:16` is a `Record<EndpointKey, Budget>` holding the
    store calls, the path and the request's `init`. Each test seeds one
    completed todo, `id-1`, through the inner store, so the counter does
    not see it. Then it builds the real route table on the counting
    store and sends one request.
- **Why through `constructRoutes` (Q3):** the handler, the validator
  and the operation all run, so a handler or a validator that reached
  the store would be counted too. A per-operation budget in
  `packages/operations` would miss both.
- **Only a success counts.** The request must answer `ok`. A 422 or a
  404 would spend 0 or 1 for reasons other than the code's cost.
- **The numbers:** every todo endpoint makes 1 store call, and
  `GET /health` makes 0.
- **The failure names the calls** (`spent 2 (listTodos, listTodos)`),
  so a double call is told apart from a call to the wrong method.
- **The proof,** shown before the commit: with a second
  `deps.dbStore.listTodos(filter)` in
  `packages/operations/src/todos/list-todos.ts`, the test failed with
  `GET /todos: budget 1 store calls, spent 2 (listTodos, listTodos)`.
  The file was restored byte for byte. Operations' unit report was not
  rewritten by the proof (only the api's vitest ran), so `check:join`
  read a current report.

## 3. BFF

Commit `7379e68`: `apps/bff/test/unit/budgets.test.ts`.

- **What:**
  - `countingApi` (line 35) is a fake `API` binding. It answers every
    request as a success with a reply the contract's schema for that
    route accepts, and it records `METHOD /path`.
  - `loads` (line 65) is a `Record<Filter, Budget>`. `actions`
    (line 73) is a `Record<keyof typeof page.actions, Budget>`, typed
    from `+page.server.ts` by a type-only import (line 11). The route
    module imports `cloudflare:workers`, which the unit tier does not
    have, so it must not run. `import type` is erased.
  - Each entry calls the `#lib/server` function the route calls
    (`loadTodos`, `addTodo`, …) with the counting binding and a form.
- **Why the route module's `actions` type, not a hand list:** an action
  added to the page without a budget fails `svelte-check`. With
  `clearCompleted` deleted from the table, `svelte-check` failed with
  `Property 'clearCompleted' is missing`. So the type names the six
  actions, not `string`. The file was restored.
- **Each unit counted alone (Q4).** The reload SvelteKit runs after an
  action is a load, and counts against the load's budget.
- **Only a success counts.** An action must not return an
  `ActionFailure` (it has no `status`). A load must not carry an
  `error` string.
- **The numbers:** `/` makes 1 (`GET /todos`, with the counts derived
  from it, deviation 5). `/active` and `/completed` make 2 (the filtered
  list and `GET /todos/counts`). Each of the six actions makes 1.
- **`load-todos.test.ts`'s `routed` fake and its two-URL assertion
  stay.** They prove which URLs are asked. The budget proves how many.
- **The proof,** shown before the commit: with an extra
  `await getTodos(api)` in `loadFiltered`, `load active` and `load
  completed` both failed, for example `load active: budget 2 api calls,
  spent 3 (GET /todos?completed=false, GET /todos/counts, GET /todos)`.
  The file was restored byte for byte.

## 4. Noted for the review

- **L36: budgets record cost; they do not limit it.** Each table's doc
  comment says so: a number is the current cost, and a change to it
  goes in the commit that changes the cost, with its reason in the
  message. The failure message names the unit, the budget and the
  spend, so the edit is a one-number change.
- **One call per unit.** Each table entry is one call: `listTodos`
  with a filter, `GET /todos?completed=true`. A unit whose cost
  depends on its input would need one entry per branch, which a
  `Record` keyed by unit cannot hold. Today every branch costs the
  same. If one ever does not, the entry becomes a list of calls.
- **The fakes are not proportional.** The api's fake store and the
  BFF's binding count calls, not work. A store call that reads 500
  rows costs the same as one that reads 1. That is row F's question,
  and it stays there.
- **`/health`'s load is not budgeted.** Q4 named the three todo loads.
  It makes one api call (`GET /health`). Budgeting it needs a second
  `Record` keyed by route, or a page-keyed table instead of a
  `Filter`-keyed one.
- **The cross-level column** in `entry-chains.md` (api calls × store
  calls × trips) is later (Q2). The three tables now hold everything
  it would read.
- **The data spec (row J)** becomes the data table's home. Each store
  call's entry carries its cost line, and the test reads it from there.
- **The wrangler telemetry** that `apps/api` and `apps/bff` try to send
  during `check`, integration and e2e was refused by the sandbox. It
  has no effect on the result.

## 5. Story delta

Chapters changed in the api story:
- **The decisions list:**
  - L11 gains its sensor: since stage 21 the cheap tier writes each
    level's cost down and fails on a unit that calls the level below
    more often (chapter 8);
  - L36 is added, in the owner's sense: budgets make cost changes
    visible and do not forbid them.
- **8, Data:**
  - "What the tests prove" gains "Budgets (L11, L36)": what a trip
    is, the three tables with each level's unit and cost, the
    `POST /todos` chain (1 × 1 × 1), and where the numbers go when
    the data spec exists;
  - the Target paragraph says the fake `DbStore` lives in
    `fake-db-store.ts`, which both api tests import.

Changed in the BFF story:
- **8, Data:** the budgeted calls per load and per action, and that
  `/health` is not budgeted yet.

Also changed:
- **Handoff 12:** row C is marked done.
- **Profile notes:** P67, budgets per level as the profile's pattern.
- **Handoff 21** is added.

Not changed:
- Chapter 6 (Operations). Row C allowed chapter 6 or 8. The data level
  owns the trip, and the other two tables sit beside it, so chapter 8
  holds the budgets. Chapter 6's ports are unchanged.
- Chapter 4's mention of `fakeDbStore()` still holds: it is the same
  function, imported from a different file.
- Chapters 0–3, 5, 7 and 9–13. None describes test cost.
- The glossary. It has no entry for the unit-tier fakes; "budget" is
  defined where L36 is.
