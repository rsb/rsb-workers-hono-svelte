# Review tour: stage 13 (the route table as data), 2026-11-03

Claude wrote this tour of stage 13 for the owner to review against the
code. It was written, not led live. The order is the build order: the
route table, then the extractor and OpenAPI, then the index, then the
checks, the governance change and the docs.

The code toured is branch `feat/route-table-data`, made from `main` at
`1f0e4d2` (PR #33 merged). It has three commits:
- `933871e` `feat(api)`: the code, the tests and the regenerated
  files. 15 files: 8 new, 7 changed.
- `6eac5cf` `ci`: `scorecard.yml` and `AGENTS.md`, under the rl-0009
  exception recorded in §4.
- the `docs(logbook)` commit: the story, the glossary, profile notes
  P54–P59, this tour, and handoffs 12 and 13.

Checks on the code commit, each tier in a fresh command:
- `pnpm check` is clean.
- `test:unit`: 327, unchanged (fail 6, business 1, contract 57, valid
  53, d1 61, operations 20, bff 70, api 59).
- `test:integration`: 29, unchanged.
- `test:e2e`: 41, unchanged.
- `pnpm check:api` exits 0. The contract's four files are unchanged,
  and `openapi.json` gains only the 15 lines of `operationId` and
  `x-unit`.
- `pnpm check:entry-chains` exits 0.
- `test:tooling`: 53, up from 31 (OpenAPI 5 → 10, parse 26, and the
  new `read.test.ts` 13 and `chains.test.ts` 4).

"Why" cites the questions of
[handoff 13](../handoffs/2026-11-03-13-route-table-as-data.md) as
Q1–Q7, and the owner's answers:

| Q | Owner's answer |
|---|----------------|
| Q1 | The route table is a `Record<EndpointKey, …>`, so both directions fail to compile; drop the step 2 unit test. `{id}` → `:id` in `http.ts` at registration. Correct chapter 11: routes were written by hand until now, and the path is now written once, in the spec |
| Q2 | Take the helper, and have it build the handler: `route({ postTodos }, { addTodo })` returns `postTodos(addTodo)`; `probe({ getHealth })` for a route with no unit. Claude names it |
| Q3 | Accepted: `openapi.json` depends on construct, and `check:api` failing when a route changes without a regeneration is the point |
| Q4 | (c) as the floor, plus a narrow (b): the port type declared in the operation's own file, and the data method carrying the port method's name. Two strict patterns, fail loudly, no compiler dependency, nothing guessed |
| Q5 | The `*Raw` functions are private, so they are not links. The driver helpers are shared links, listed once at the top with `present.ts` and `mapFailure`. L24's example ends at the data method, and chapter 9 says why. Do not export `*Raw` |
| Q6 | Yes, in a separate commit: `check:api`, the index check and `test:tooling` go into `scorecard.yml`, with the rl-0009 exception recorded in this tour |
| Q7 | In that same commit, under the same exception: the index is for agents |

## 1. The route table

`apps/api/src/http.ts`:

```ts
export type Route = { name: string; unit: string | null; handler: Handler };
export type Routes = Record<EndpointKey, Route>;
```

- **What:** a route no longer holds a method or a path. Its key is the
  endpoint, and `serve` looks the key up in the contract's `endpoints`.
  `honoPath` turns `/todos/{id}` into `/todos/:id`. Routes are
  registered in the order construct lists them.
- **Why:** Q1. `http.ts` already imported the contract (chapter 9 lets
  the HTTP module import contract and nothing else of ours), so the
  translation sits at the one boundary that knows Hono's form.
- **Proof:** with `constructRoutes` broken three ways in a scratch
  copy, `tsc` failed each time:
  - a missing `"DELETE /todos"` failed with `TS2741 Property
    '"DELETE /todos"' is missing`;
  - an unknown `"GET /todos/count"` failed with `TS2353`;
  - `route({ getTodos }, { countTodos })` failed with `TS2322
    'CountTodos' is not assignable to type 'ListTodos'`.

`apps/api/src/construct.ts`:

```ts
export const constructRoutes = (operations: Operations): Routes => {
  const { addTodo, listTodos, countTodos, updateTodo, setAllCompleted, deleteTodo, deleteCompleted } = operations;

  return {
    "GET /health": probe({ getHealth }),
    "GET /todos": route({ getTodos }, { listTodos }),
    ...
    "DELETE /todos/{id}": route({ deleteTodo: deleteTodoHandler }, { deleteTodo }),
  };
};
```

- `route` takes `<K extends keyof Operations>`. The handler is
  `Record<string, (unit: Operations[K]) => Route["handler"]>`, and the
  unit is `Pick<Operations, K>`. TypeScript infers `K` from the unit's
  key, and then checks that the handler takes that unit.
- `named` reads the one entry of `{ name: value }`. It throws at
  construct time when an object has more or fewer than one key. The
  types do not stop a two-key object, but every test that builds the
  routes would fail on one.
- Q2: names are read from identifiers. The one clash, the
  `deleteTodo` handler and the `deleteTodo` unit, is named by an
  explicit key.
- The destructured operations hide the operation builders imported at
  the top of the file. A comment says so (§6).

`apps/api/test/unit/construct.test.ts` is unchanged: it builds
`constructRoutes(operations)` and serves it, so the whole route table
runs through the new `serve` there too.

## 2. The extractor and OpenAPI

`tooling/entry-chains/routes.ts`, `readRoutes(constructPath)`:
- It imports construct with Node's type stripping, as the probe in
  handoff 13 did.
- It builds the operations on a `Proxy` store whose every method
  throws, then the routes.
- It returns `{ key, name, unit }` for each route.

`tooling/api-spec/emit-openapi.ts`:
- `emitOpenApi(spec, routes, source, script)` writes `operationId`
  first, then `x-unit` when the route has a unit, then the existing
  description.
- `routeByKey` fails when the routes and the spec's endpoints differ
  in either direction. The compiler already holds this. The check is
  for a construct not type-checked since the spec changed, and it is
  one map lookup. It is not the dropped step 2 test: it runs only when
  the document is generated.
- The header's "Not here yet" line is gone.

`tooling/api-spec/generate.ts` (Q3):
- It takes a fourth argument, the construct file. `gen:api` and
  `check:api` pass `apps/api/src/construct.ts`.
- It writes, or under `--check` compares, the four contract files
  first, then loads construct, then the OpenAPI document.
- A mismatch is reported against both sources: "differs from what
  prd/todo/api.md and apps/api/src/construct.ts generates".
- `main` is now async.

Tests (`emit-openapi.test.ts`, 5 → 10):
- `operationId` equals each route's name, and `x-unit` its unit;
- every `operationId` is different;
- the probe has no `x-unit`;
- an endpoint with no route, and a route with no endpoint, each throw.

## 3. The index

```
tooling/entry-chains/
├─ routes.ts       the extractor (§2)
├─ read.ts         the readers: imports, the use case line, the two patterns, package resolution
├─ chains.ts       follows each route; collects the shared links
├─ emit.ts         writes the markdown
└─ generate.ts     the CLI: gen:entry-chains, check:entry-chains
```

How one chain is followed (`chains.ts`):

1. **Handler.** Construct's import of `route.name` from a relative
   path gives the handler's file. That file must export the name.
2. **Rules.** The handler's value imports from `@todo/valid/` are its
   rules rows. Its relative imports go to the shared links.
3. **Unit.** Construct's import of `route.unit` from
   `@todo/operations/` gives the operation's file. That file must
   export the unit and cite exactly one use case, and the use case
   file must exist.
4. **Port.** Strict pattern 1, `portOf`: exactly one
   `export type <Name>Store = {` in the operation's file, every line
   `  method(`.
5. **Data.** Strict pattern 2, `tableStoreOf`. Construct's
   `createDbStore` import gives `store.ts`. Each `...xStore(db)` there
   gives a table file, which must export one
   `export const xStore = (db: D1Database) => ({` with methods written
   `  method: async (`. The port method's name must be one of them, and
   two table stores may not share a method name. Each table file's
   `./driver.ts` imports become the shared `driver` row.

Package imports resolve through each workspace's `exports` map, so
`@todo/valid/fields/*` does not resolve, just as it does not for
`tsc`.

Every failure is a `ChainError` carrying the file's path and what it
lacks, for example
`apps/api/src/construct.ts: imports removeTodo as an entry point 0 times; it must import it once`.
That message came from a scratch copy whose route key was renamed.
With a line appended to the index, `--check` reported
`apps/api/entry-chains.md differs from what apps/api/src/construct.ts generates`.

The output is `apps/api/entry-chains.md`:
- Its first line names the source and the script, and says not to
  edit it.
- A "Shared links" block lists `serve`, the failure handlers, the
  handler helpers and the driver helpers.
- Each route has a block with its chain line and rows. The columns
  line up across the whole file.
- The PATCH block matches the updated chapter 9 example exactly. So
  does `chains.test.ts`.

Tests:
- `read.test.ts` (13) covers each reader and each failure. A port
  written as a property (`method: (…) =>`) fails rather than being
  skipped. So does a store written as a `function`, and a package path
  that is not exported.
- `chains.test.ts` (4):
  - one chain per route, in construct's order;
  - the PATCH line;
  - the probe ends at the probe;
  - the driver is listed once and in no chain.

## 4. Checks and the governance change (rl-0009 exception)

**Recorded exception, rl-0009.** The owner decided both changes in
the stage 13 answers (Q6, Q7). They are in their own commit,
`6eac5cf`:
- `.github/workflows/scorecard.yml` gains three steps after
  `pnpm check`: `pnpm check:api`, `pnpm check:entry-chains` and
  `pnpm test:tooling`.
  - No action is added or changed, so the SHA pins and
    `permissions: contents: read` are as they were (rl-0011).
  - The workflow's header says every stage added later is a recorded
    change in the logbook; this section is that record.
- `AGENTS.md` gains a "Finding code" section. It points to
  `apps/api/entry-chains.md` and says to run `pnpm gen:entry-chains`
  after changing a route, a handler, an operation's port or a data
  method.
- No secret is involved (rl-0012).

The new CI steps run after `pnpm install --frozen-lockfile`. Both
generators load construct through `apps/api/node_modules`, which the
install creates. Nothing was added to any `package.json` except the
two root scripts, so the lockfile is unchanged.

## 5. Docs

- **The story:**
  - **Ledger:** L24 notes that stage 13 built the generator and that a
    chain ends at the data method.
  - **Chapter 2:** `serve` registers each route at its contract method
    and path, and `http.ts` exports `Routes`.
  - **Chapter 4:** the builders block gives `constructRoutes(operations): Routes`.
    A new section, "The route table is data", covers the key, `route`
    and `probe`, the clash, the hidden builders, and the extractor.
  - **Chapter 9:** the example ends at the data method, with `{id}`.
    The text says why (Q5), the index example matches the generated
    block, and a new paragraph, "The generator", names the two
    patterns. The "Open" list drops the generator and the `AGENTS.md`
    pointer, and gains ports with more than one method, and processes.
  - **Chapter 11:**
    - the api's routes were written by hand until stage 13, and the
      path is now written once, in the spec. The BFF still hard-codes
      its paths;
    - `operationId` and `x-unit` are generated, and `openapi.json`
      depends on construct;
    - the routes-vs-spec target is done by the compiler;
    - the scorecard runs the three checks.
- **The glossary:**
  - the entry chain's example and status;
  - the OpenAPI status;
  - the `tooling/` open item.
- **Profile notes:** P54–P59 are candidates.
- **Handoffs:** handoff 12 gets the three lines fixed at the start of
  this stage, and handoff 13 gets the owner's answers and its outcome.

No new L number: this builds what L24 and L26 decided, and the owner
gave none.

## 6. Open for the owner

### Smaller choices, kept unless the owner objects

- **Hidden builders.** `constructRoutes` destructures the operations
  so that `route(…, { addTodo })` reads a plain identifier. Inside
  that function, `addTodo` is the built operation, not the builder
  imported at the top. The alternative,
  `{ addTodo: operations.addTodo }`, writes every name twice.
- **The data row names the store.** It reads `todoStore.updateTodo`.
  L24's example read only `updateTodo`. `todoStore` is the exported
  symbol, and grepping `updateTodo` in `todos.ts` also finds
  `updateTodoStmt` and `updateTodoRaw`. The chain line keeps L24's
  `d1.updateTodo`.
- **The index's first line is plain text,** not an HTML comment, so it
  shows when the file is rendered too.
- **`todos/present.ts` is a shared link** under `handlers`. It is
  shared by the todo handlers, not by the probe. The index lists the
  handlers' relative imports as found, without judging how widely
  each is shared.
- **A port with more than one method fails the generator,** rather
  than taking a written form for its chain. Every port has one method
  today. Story chapter 9 lists this as open.
- **The generators load construct with Node's type stripping.** Every
  file construct imports must stay strippable: no `enum`, no
  `namespace`, no parameter properties. `tsc` accepts all three, so
  only `check:api` and `check:entry-chains` would catch one, failing
  with Node's error.

### Housekeeping

- The root dotfiles stay untracked and unignored, as before.
- Nothing is pushed. The owner pushes and opens the PR.
