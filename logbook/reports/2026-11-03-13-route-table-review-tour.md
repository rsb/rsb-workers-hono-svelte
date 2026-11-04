# Review tour: stage 13 (the route table as data), 2026-11-03

Claude wrote this tour of stage 13 for the owner to review against the
code. It was written, not led live. The order is the build order: the
route table, then the extractor and OpenAPI, then the index, then the
checks, the governance change and the docs.

The code toured is branch `feat/route-table-data`, made from `main` at
`1f0e4d2` (PR #33 merged). It has four commits:
- `933871e` `feat(api)`: the code, the tests and the regenerated
  files. 15 files: 8 new, 7 changed.
- `6eac5cf` `ci`: `scorecard.yml` and `AGENTS.md`, under the rl-0009
  exception recorded in §4.
- `f900173` `docs(logbook)`: the story, the glossary, profile notes
  P54–P59, this tour, and handoffs 12 and 13.
- the `fix(api)` commit: what a full review of the branch found
  (§7). It makes the route checks and the readers strict, adds their
  failure tests, and corrects this tour and the docs where they
  claimed more than the code held.

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
  new `read.test.ts` 13 and `chains.test.ts` 4). After the review
  commit it is 95 (§7).

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

  That last case failed only because `CountTodos` returns another
  type. `route({ getTodos }, { deleteCompleted })` compiled, since a
  unit with fewer arguments is assignable. The review found this, and
  the `route` below is the corrected one (§7).

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

- `route` takes `<K extends keyof Operations, U>`. The handler is
  `Record<string, (unit: U) => Route["handler"]>`, and the unit is
  `Pick<Operations, K> & Runs<K, U>`. TypeScript infers `K` from the
  unit's key and `U` from the handler's parameter. `Runs` is `unknown`
  when `K` is the one operation whose type is exactly `U`; otherwise
  it is an object with a property no argument has, so the call does
  not compile and the error names the rule. So a unit with fewer
  arguments, no unit, two units, and two operations of one type all
  fail `tsc`.
- `probe` takes `(c: Context) => Response | Promise<Response>`, so a
  handler that takes a unit does not compile there.
- `named` reads the one entry of `{ name: value }`. It throws at
  construct time when an object has more or fewer than one key. The
  types now reject both for `route`'s unit; `named` stays as the
  runtime guard for the handler side.
- Types cannot see a name: `{ getTodoCounts: getTodos }` is a valid
  record. The extractor checks the names against the text (§2).
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
- It returns `{ key, name, unit }` for each route, and fails on a
  route whose `name` is missing or whose `unit` is neither a name nor
  `null` (`rowOf`).
- It reads construct's text and fails when a name is not its value's
  own (`checkWritten`):
  - `routeLinesOf`: one route per line, `route({ handler }, { unit })`
    or `probe({ handler })`, and the unit written by its own name,
    taken from the `const { … } = operations;` line;
  - a handler given as `{ name: value }` must be construct's import of
    the handler `name`;
  - `operationLinesOf`: one `name: builder({ … }),` per line, and the
    builder must be construct's import of the operation `name`;
  - the routes built are the routes written, in order, and no two
    share an entry point's name.

`tooling/api-spec/emit-openapi.ts`:
- `emitOpenApi(spec, routes, source, script)` writes `operationId`
  first, then `x-unit` when the route has a unit, then the existing
  description.
- `routeByKey` fails when the routes and the spec's endpoints differ
  in either direction, and when two routes share an `operationId`.
  The compiler already holds the first. The check is
  for a construct not type-checked since the spec changed, and it is
  one map lookup. It is not the dropped step 2 test: it runs only when
  the document is generated.
- The header's "Not here yet" line is gone.

`tooling/api-spec/generate.ts` (Q3):
- It takes a fourth argument, the construct file. `gen:api` and
  `check:api` pass `apps/api/src/construct.ts`.
- It writes, or under `--check` compares, the four contract files
  first, then loads construct, then the OpenAPI document.
- A mismatch is reported against both sources and names the command:
  "differs from what prd/todo/api.md and apps/api/src/construct.ts
  generate; run pnpm gen:api".
- A `ChainError` from the extractor is printed as it is; only the
  routes-against-spec failures are prefixed with the construct's path.
- `main` is now async.

Tests (`emit-openapi.test.ts`, 5 → 11):
- `operationId` equals each route's name, and `x-unit` its unit;
- every `operationId` is different;
- the probe has no `x-unit`;
- an endpoint with no route, a route with no endpoint, and two routes
  with one `operationId` each throw.

## 3. The index

```
tooling/entry-chains/
├─ routes.ts       the extractor and its check against construct's text (§2)
├─ read.ts         the readers: imports, the use case line, the two patterns, construct's routes and operations, package resolution
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

Each form is read whole, so a line the patterns do not read fails
rather than being skipped:
- `importsOf`: every line starting `import` is a named, namespace or
  bare import ending in `;`, and every item is a bare name. A comment
  between the braces, a default import beside named ones, or a
  missing `;` fails. Before the review each was misread or dropped.
- `tableStoreOf`: every line at the store's own depth is a method,
  `},` or a comment. `  updateTodo(id) {` fails.
- `spreadsOf`: every line of `createDbStore` is `  ...xStore(db),`.
  An `updateTodo:` entry beside the spreads would replace the table's
  method, so it fails.
- Construct imports its failure handlers from exactly one file.

Package imports resolve through each workspace's `exports` map, so
`@todo/valid/fields/*` does not resolve, just as it does not for
`tsc`. When patterns overlap, an exact key wins, then the pattern with
the longest part before its `*`, as Node picks.

Every failure is a `ChainError` carrying the file's path and what it
lacks, for example
`apps/api/src/construct.ts: imports removeTodo as an entry point 0 times; it must import it once`.
That message came from a scratch copy whose route key was renamed.
With a line appended to the index, `--check` reported
`apps/api/entry-chains.md differs from what apps/api/src/construct.ts generates; run pnpm gen:entry-chains`.

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
- `read.test.ts` (29) covers each reader and each failure. A port
  written as a property (`method: (…) =>`) fails rather than being
  skipped. So do a store written as a `function`, a package path that
  is not exported, and each form in the list above.
- `routes.test.ts` (10): `checkWritten` and `rowOf`, each name check
  passing once and failing once.
- `chains.test.ts` (4), on the real repo:
  - one chain per route, in construct's order;
  - the PATCH line;
  - the probe ends at the probe;
  - the driver is listed once and in no chain.
- `chains-fixture.test.ts` (7): `readChains` on a small repo written to
  a temporary directory, one change per test: a handler that does not
  export the name, a cited use case that does not exist, a port method
  with no data method, a method in two table stores, a unit imported
  twice, no failure handlers.
- `emit.test.ts` (3): `emitIndex`'s first line, columns and blocks.
- `generate.test.ts` (5): both generators' `--check`, run as CI runs
  them, passing on the committed files and failing on a stale or
  missing one.

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
  with Node's error. Nor may anything construct imports, directly or
  through a package, import a `cloudflare:*` module, which Node cannot
  load. `index.ts` imports `cloudflare:workers` and construct does not
  import `index.ts`; keep it so.

### Not done in this round

- `AGENTS.md`'s Commands list does not name `gen:api`, `check:api`,
  `gen:entry-chains`, `check:entry-chains` or `test:tooling`, and its
  regeneration line does not mention the operations in construct.
  Changing it needs another rl-0009 exception; the owner left it for
  a later round.
- `tooling/` is not type-checked in CI. `tsc` over its 17 files was
  clean when checked by hand for this commit.
- The three generator steps could run before the Playwright install,
  to fail sooner. That is a `scorecard.yml` change, so rl-0009 again.

### Housekeeping

- The root dotfiles stay untracked and unignored, as before.
- Nothing is pushed. The owner pushes and opens the PR.

## 7. The full review, and what it changed

At the owner's request, a separate agent reviewed the whole branch,
reading every file it touches in full rather than the diff, and tried
each doubt on a scratch copy. It found no blocker and every check
green, and these, all fixed in the `fix(api)` commit:

1. **Names were trusted, not checked.** The generators read each name
   from an object key. `route({ patchTodos }, { setAllCompleted:
   deleteCompleted })`, `route({ getTodoCounts: getTodos }, { listTodos
   })` and `setAllCompleted: deleteCompleted({ … })` each type-checked
   and generated a wrong chain or `operationId`, exit 0. Now
   `checkWritten` fails on all three, and `emitOpenApi` refuses a
   repeated `operationId` (§2).
2. **A wrong pair type-checked when the unit takes fewer arguments.**
   `route({ getTodos }, { deleteCompleted })` and `route({ getTodos },
   {})` compiled, and `probe` took any handler. Now the handler must
   take exactly the unit's type (`Runs`), and `probe` takes the request
   (§1). Branding each operation type was the other way. It was not
   taken: the handler tests pass plain fakes,
   `getTodos(async () => ok(todos))`, and every one would need a cast.
3. **`spreadsOf` searched for spreads** and missed any other entry in
   `createDbStore`. Now it reads the whole body (§3).
4. **`tableStoreOf` skipped method lines it could not read.** Now it
   fails on them (§3).
5. **`importsOf` misread or dropped** an import with a comment between
   the braces, a default import beside named ones, or no `;`. Now each
   fails (§3).
6. **`readRoutes` did not check what it was given.** A route with no
   `name` dropped its `operationId`. Now `rowOf` fails on it (§2).
7. **The failure paths were untested.** 42 tests were added (§2, §3):
   53 → 95.
8. **The docs claimed more than the code held:** "the names cannot
   drift" and "the handler must take it" (story chapter 4), "nothing is
   guessed" (chapter 9), P55, P58, and this tour's §1–§3. Each now says
   what is checked, and by what.

Smaller fixes in the same commit:
- both generators name `pnpm gen:api` or `pnpm gen:entry-chains`;
- "generates" → "generate" after two sources;
- every `fail` in `chains.ts` is returned, and `fail` is defined once,
  in `read.ts`;
- the shared rows sort by plain comparison, not `localeCompare`, so
  the index does not depend on the locale;
- the `errors` row lists value imports only.

Proof, each with the change made and then reverted in the real files:
- the three name cases fail both `check:entry-chains` and `check:api`,
  each with the construct's path and the line or name at fault;
- an `updateTodo:` entry in `createDbStore` fails `check:entry-chains`;
- `tsc` rejects `route({ getTodos }, { deleteCompleted })`,
  `route({ getTodos }, {})`, two units, `probe({ getTodos })`, and a
  second operation typed `ListTodos`;
- `pnpm check` is clean; `check:api` and `check:entry-chains` exit 0
  with both generated files unchanged; `tsc` over `tooling/` is clean;
- `test:tooling` 95, `test:unit` 327, `test:integration` 29 and
  `test:e2e` 41, each in a fresh command, the last three unchanged.
