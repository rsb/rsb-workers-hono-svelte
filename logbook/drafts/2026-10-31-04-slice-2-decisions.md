# Slice 2 (Add and list): decisions settled by Claude

Working agreement (owner, 2026-10-31, handoff 03): Claude settles the
open questions, builds on them, and presents them back in a review
tour, "so we see the api story evolves to handle this new complexity".
A decision the owner changes at the tour is recorded here, with what
it changed in the code.

Each entry gives the decision, the reason, and what it constrains in
the code, and cites the question it answers. Question numbers are
those under "Open, raised in the review" in
[2026-10-30-02-slice-1-decisions.md](2026-10-30-02-slice-1-decisions.md);
"new" questions are the ones handoff 03 added.

Paths are under `apps/todo/api/src/` unless they say otherwise.

## Layout the decisions produce

This is the layout at the end of slice 2. Refactor A has since moved
business, operations and data into packages; the current layout is in
[the api story](../the-api-story.md), chapter 0.

```
api/src/
├─ index.ts                     the story: construct, then wire (D3, D9)
├─ construct.ts                 builds everything once per isolate (D3, D15)
├─ http.ts                      our HTTP module; drives Hono (D3, D16)
└─ app/
   ├─ handlers/
   │  ├─ present.ts             success, failure (S1)
   │  ├─ validate.ts            readJson (D4)
   │  ├─ health/health.ts       getHealth
   │  ├─ errors/errors.ts       notFound, tooLarge, onError
   │  └─ todos/
   │     ├─ present.ts          presentTodo: business → wire (D2)
   │     ├─ get-todos.ts        getTodos(listTodos)
   │     └─ post-todos.ts       postTodos(addTodo)
   ├─ operations/todos/
   │  ├─ add-todo.ts            addTodo({ store, newId }), AddStore (D5, D13)
   │  └─ list-todos.ts          listTodos({ store }), ListStore
   ├─ business/
   │  ├─ result.ts              Result, ok, err (D10)
   │  └─ todos/todo.ts          Todo, TODO_LIMIT, newTodo (D13)
   └─ data/memory/todos.ts      memoryTodos(): rows in a Map (D13, D15)
```

## D1 Contract is the wire; business does not import it (Q3, first half)

**Decision.** The title rule (trim, then 1–256) is defined once, in
contract, as `TITLE_MAX` and the `Title` schema inside `AddTodoBody`.
The api applies it at the edge, in the handler's validate duty. The
operation receives a title that is already valid and does not check it
again. Business imports nothing of ours, contract included.

In the api, only the HTTP edge imports contract: the handlers layer
(schemas, `ErrorKind`, reply types) and `http.ts` (`BODY_LIMIT_BYTES`).

**Reason.** R6 says business imports none of our packages, and the PRD
says the limit is defined once in contract and used by both the BFF
and the api. Both hold only if the api checks the limit at its edge.
The title rule bounds input (C-secure), which is a wire concern. No
business behaviour depends on it.

**Constrains.** No `@todo/contract` import under `app/operations`,
`app/business` or `app/data` (scan). `addTodo` takes `title: string`
and does not trim it.

## D2 A todo is two types (Q3, second half)

**Decision.** Contract has the wire schema `TodoReply`
(`{ id, title, completed }`, strict). Business has its own `Todo`
type. They have the same fields today. The todos handler package maps
one to the other in `handlers/todos/present.ts`:
`presentTodo(todo: Todo): TodoReply`, which copies the three fields by
name.

**Reason.** The mapping is the present duty of R5. TypeScript does not
report extra properties when it checks a variable, so if `Todo` gained
a field (for example `createdAt`), it would reach the wire silently.
The web's strict schema would then reject every reply. Copying by name
means a business field reaches the wire only when someone adds it to
`presentTodo` and to `TodoReply`. This also settles the tour point
"`success` data is not tied to the contract type" for todos, because
the mapper's return type is the contract type.

**Constrains.** Handlers never pass a business object to `success`
directly. Each reply goes through a `present*` function whose return
type comes from contract.

## D3 Our HTTP module is `http.ts`; handlers take Hono's types from `hono` (Q4; refactor step 2)

**Decision.**
- `http.ts` sits in the composition zone. It exports `serve(api)`,
  which:
  - builds the Hono app;
  - registers the per-request middleware (D16);
  - registers each route from a route table;
  - registers the not-found and error handlers.

  It also exports the types `Api` and `Route`.
- `construct.ts` builds the route table (R4).
- `index.ts` reads: construct, then serve. `app.ts` is removed.
- Handlers import `Context` from `hono` directly. Third-party imports
  are not governed by our layer rules, and nothing under `app/`
  imports `http.ts`.
- Allow-list addition (R7): construct may import the HTTP module's
  types (`import type` only), so that a route-table typo fails in
  construct, not in `index.ts`.

**Reason.** R2: `index.ts` tells the story in our words, and our deep
module speaks Hono. Handlers are HTTP entry points, so `Context` is
their input type, and wrapping it would hide Hono behind a type of
ours for no gain. The first injection (`addTodo` into `postTodos`)
needs construct, so refactor step 2 happens now.

**Constrains.** `hono` is imported only by `http.ts` and files under
`app/handlers/`. `index.ts` imports only `construct.ts` and `http.ts`.
Nothing imports `index.ts`.

## D4 Validation is plain valibot, in the handlers parent (Q5)

**Decision.** `handlers/validate.ts` exports `readJson(c, schema)`. It
reads the body as JSON and parses it with a contract schema, and it
returns `Result<Output, Invalid>` with `Invalid = { field, message }`.
- A body that is not JSON gives `field: "body"`.
- A schema issue gives the first issue's first path key as `field`
  (`title`, or the name of an unknown key), or `"body"` when the issue
  has no path.

The handler turns `Invalid` into a `validation` envelope.
`@hono/valibot-validator` is removed from `api/package.json`.

**Reason.**
- Hono's `validator('json')` throws `HTTPException(400, "Malformed
  JSON in request body")`. Our `onError` turns that into a 500, but
  the PRD wants a 422 (`hono/dist/validator/validator.js:18`).
- When the content type is not JSON, it validates `{}` instead of the
  body (line 14).
- A returned value keeps all four of R5's duties visible in the
  handler, and keeps errors on the request path as values (PRD,
  Shape).
- The handler stays a plain `(c: Context) => Promise<Response>`, which
  the unit tier calls with `new Context(new Request(…))`.

P25 was the owner's choice, and it changes here: valibot stays, but
the Hono adapter goes. The draft asks the owner to confirm this at the
tour.

**Constrains.** No `vValidator` and no `c.req.valid`. Every handler
that reads a body calls `readJson` first. `validate.ts` is the only
place that calls `c.req.json()`.

## D5 Siblings share through a parent; each operation declares its own store interface (Q6)

**Decision.**
- **Within one package** (one directory), files may import each
  other.
- **Sibling packages** do not import each other. They share through
  their common parent.
- **Store interface:** there is no shared one.
  - `addTodo` declares `AddStore` (`count`, `add`) in its own file.
  - `listTodos` declares `ListStore` (`list`) in its own file.
  - The memory store satisfies both, and construct passes the same
    store to each.
- **Todos handlers:** one package, `handlers/todos/`, with one file
  per handler and a `present.ts` that both use. Both also import the
  parent's `present.ts` and `validate.ts`.

**Reason.** R9 says small interfaces are declared by the code that
uses them, so a shared `TodoStore` would be the Java habit it rules
out. The two operations change for different reasons, so they share
nothing yet. A file per handler keeps P32 (one named export per
handler file) and the handler templates easy to scan. One package per
resource keeps depth low: the deepest file in slice 2 is at level 2.

**Constrains.** The scan rule is: an import between two different
directories must go to an ancestor directory, or across layers by an
allowed edge (D6). Same-directory imports are free.

## D6 Cross-layer imports may reach any depth, downward, and may skip a layer (Q7)

**Decision.**
- A handler may import any operations package, at any depth, and may
  also import business directly.
- The edges are:

  ```
  handlers → operations → business
  handlers → business
  data → business
  ```

- No upward edge, and no edge into handlers or data.
- Privacy is still not shown (S1).

**Reason.** `presentTodo` takes a business `Todo`, and handlers turn
`Result` (business, D10) into envelopes. Sending those types through
operations would only re-export them. Skipping downward cannot create
a cycle, so the scan stays exact.

**Constrains.** The story's edge list gains `handlers → business`.
Handlers import operation types with `import type`, and they get the
operation itself from construct.

## D7 A depth-5 reason sits at the head of the package (Q8)

**Decision.** If a package needs level 5, the first line of its main
file is a `// depth 5: <reason>` comment, and the decisions draft of
its slice has an entry. Slice 2 needs no such package: its deepest
level is 2 (`handlers/todos/`, `operations/todos/`, `business/todos/`,
`data/memory/`).

**Reason.** The scan that measures depth reads that file, so the
reason sits beside the path that needs it.

**Constrains.** A scan can find a level-5 path without the comment.

## D8 Constructor functions return closures; there are no classes and no `this` (Q9)

**Decision.**
- A unit with dependencies is a function that takes them and returns
  the function (or plain object) that does the work:
  - `addTodo({ store, newId })` returns `(title) => Result`.
  - `postTodos(addTodo)` returns `(c) => Promise<Response>`.
  - `memoryTodos()` returns `{ add, count, list }` as closures over a
    `Map`.
- The exported type of what a constructor returns is named after it in
  PascalCase (`AddTodo`, `ListTodos`).
- A handler with no dependencies stays a plain value (`getHealth`,
  `notFound`, `tooLarge`, `onError`).
- No `class`, no `this`, no `extends`.

**Reason.**
- Closures cannot lose a `this` when Hono receives a method, so the
  binding question goes away.
- Plain functions and objects are Go's and Rust's default (R9).
- Mixed handler shapes (a tour point) now follow one rule: constructed
  if and only if the handler has something to inject.

**Constrains.** `class` and `this` do not appear under `api/src`
(grep). Construct is the only caller of a constructor, apart from the
tests.

## D9 No config in slice 2 (Q10, Q11)

**Decision.** Slice 2 reads no environment value, so there is no config
package. `index.ts` tells a two-step story (construct, wire), and the
story's config chapter says that config arrives with the first
environment value. Q10 (failure at module load) stays open until then.

**Reason.** The owner said not to create config before it is needed
(report 03 §4). `TITLE_MAX` and `BODY_LIMIT_BYTES` are wire facts
(contract), and `TODO_LIMIT` is a business fact. None of them is
environment.

**Constrains.** No `config.ts`, and no `env` parameter on `fetch`.

## D10 `Result` lives in business; handlers map each operation error explicitly (Q12, C4)

**Decision.**
- `app/business/result.ts` holds the hand-rolled
  `Result<T, E> = { ok: true, value: T } | { ok: false, error: E }`
  and the helpers `ok` and `err`. It is not in contract.
- An operation that can fail returns `Result`. An operation that
  cannot fail returns its value (`listTodos` returns
  `readonly Todo[]`).
- Operation errors are business values. `addTodo` fails with
  `{ kind: "full" }`. The handler maps each one to an envelope kind
  (`full` → `limit`) with a message.
- `readJson` (D4) returns `Result` too.

**Reason.**
- Business is pure, imports nothing, and anything may import it, so
  every layer that returns or reads a `Result` can reach it with no
  new layer or edge.
- C4's reasons still hold: only the api uses it, so it stays out of
  contract.
- Business names its own failures. The handler's error duty translates
  them, so a business word never has to match a wire word.

**Constrains.** `ok(`/`err(` come only from `business/result.ts`. The
handler is the only place a business error becomes an envelope kind
(C4's rule, now placed).

## D11 Health still ignores the store (C2)

**Decision.** C2 stands. `getHealth` has no dependencies and returns
`{ ok: true }`.

**Reason.** The store is in memory, in the same isolate as health, so
it cannot be down while the Worker is up. C2's revisit condition (an
external binding) has not arrived.

**Constrains.** `construct` passes nothing to `getHealth`.

## D12 Still no web integration tier (C5)

**Decision.** C5 stands. The new BFF code is covered by web unit tests
(fake binding) and e2e (real binding).

**Reason.** The web still has only one integration point, the `API`
binding, and slice 2 does not add another. A form action that reaches
the API through a fake binding is a unit test, and through the real
one it is e2e.

**Constrains.** No `web/vitest.integration.config.ts`.

## D13 Business makes a todo, the operation supplies the id, and the store keeps the order (new: who creates a todo)

**Decision.**
- `newTodo(id, title)` in business is pure and returns
  `{ id, title, completed: false }`.
- `addTodo` gets the id from an injected `newId: () => string`.
  Construct passes `() => crypto.randomUUID()`.
- Creation order is a promise of the port: `ListStore.list()` returns
  todos "in the order they were added".
- The memory store keeps that order because a `Map` iterates in
  insertion order.
- Business `Todo` has no order field.

**Reason.**
- Business may not call `crypto`, because randomness is io. Data only
  maps (R6), so it does not make ids either.
- Injecting `newId` lets the unit tier see a known id without stubbing
  a global.
- Order is something a store either keeps or does not. A database
  would map it to a sequence column inside its own data package.

**Constrains.** No `crypto` under `app/business` or `app/data`. The
memory store copies todos in and out (its row is `{ title, completed }`
keyed by id), so a caller cannot change stored state by mutating a
returned object.

## D15 The store is built once per isolate (new: where the store lives across requests)

**Decision.** `index.ts` calls `construct()` at module load, which is
R1's once-per-isolate half. `construct` calls `memoryTodos()` once and
hands the same store to both operations. The todos live as long as
the isolate. `wrangler dev` runs one isolate, so todos survive a
reload (scenario 2.8) and are lost on restart (deviation 3).

**Reason.** It is the only place where something built once can
outlive a request, and R1 puts it there.

**Constrains.** Nothing in the per-request half (middleware, handlers)
builds a store. Integration tests share one isolate per test file, so
each todos test file starts from an empty store, and the tests within
a file share it.

## D16 Middleware stays in `http.ts`, still unnamed (new: middleware's home)

**Decision.** The per-request half is still only `bodyLimit`. It is
built inside `serve` and registered first, before any route. Nothing
moves into `app/`, so the layer name (`middleware`, the owner's
"middle") stays unsettled.

**Reason.** Handoff 03: "Settle the name if anything moves." Nothing
does. `bodyLimit` is Hono's middleware configured with a contract
value, which is the HTTP module's job.

**Constrains.** `http.ts` is the only file that calls `app.use`.

## D17 Tour points from handoff 02

Settled in slice 2:
- **The non-validation kinds are listed twice:** contract now defines
  `OtherKind` once, and builds `ErrorKind` from `validation` plus
  `OtherKind.options`.
- **The `console.error` stub is never restored:** the api unit config
  sets `restoreMocks: true`.
- **`success` data is not tied to the contract type:** D2 for todos.
  Health's `{ ok: true }` is still a literal.
- **Handler types are mixed:** D8 gives the rule.

Still open, with what slice 2 changed:
- **`onError` turns `HTTPException` into a 500.** After D4 nothing on
  the request path throws one, so the case is unreachable, but the
  code is unchanged.
- **The `bodyLimit` streaming path is untested.** Slice 2 adds the
  first route with a body. The case stays open (not attempted).
- **A 2xx `Failure` has no web test.** The new todos client decides by
  the body, not the status (D18), so a 2xx `Failure` is a failure. Its
  unit test covers it.

## D18 The BFF: one page, one named action, a client that returns envelopes (BFF, first pass)

**Decision.**
- `web/src/routes/+page.server.ts` has a one-line `load` and one named
  action, `add`. Each passes `env.API` to a function in
  `#lib/server/todos/` (P29).
- `#lib/server/api/` is the API client, the BFF's data:
  - `getTodos(api)` and `postTodo(api, body)` call the API through the
    binding.
  - They parse the reply with contract schemas and return the
    contract envelope.
  - Any transport failure, non-JSON body or body that is not the
    envelope becomes a `Failure` of kind `internal`.
- `#lib/server/todos/`:
  - `loadTodos(api)` returns `{ todos, error }`, with
    `error: string | null`.
  - `addTodo(api, form)` follows R5's four duties:
    1. validate the form with contract's `AddTodoBody`;
    2. call `postTodo`;
    3. map a `Failure` to `fail(status, { title, message })`;
    4. return `{ added: title }`.
- The status map for `fail` belongs to the BFF: `validation` 422,
  `limit` 409, anything else 500.
- `readHealth` is unchanged.

**Reason.**
- F2 still holds: a load cannot be handed a fake binding. The thin
  route plus a `#lib` function keeps every branch unit-testable.
- Returning the envelope reuses contract's type as the BFF's result,
  so the BFF needs no `Result` of its own.
- `loadTodos` returns its error as data, not `error()`, because errors
  on the request path are values (PRD, Shape).
- A named action costs nothing now, and SvelteKit does not allow a
  default action next to named ones, which slice 3 will add.

**Constrains.** No `fetch(` in `web/src` except on a binding
parameter. `cloudflare:workers` is imported only by `+page.server.ts`
files. No `{@html}`.

## D19 E2E shares one API across the run (scenarios 2.1–2.8)

**Decision.**
- `playwright.config.ts` sets `workers: 1`, so the files run one at a
  time, in file order.
- Scenario 2.1 ("given no todos") is the first test of
  `e2e/add-and-list.test.ts`, which is first alphabetically.
- The other scenarios assert on the last items of the list, so they
  hold whatever was added before them.

**Reason.**
- The API Worker starts once per run (`reuseExistingServer: false`),
  and its store lives as long as its isolate (D15).
- There is no route that empties the store, and adding one only for
  tests would widen the API (deviation 2's spirit).
- Restarting the API per test would cost more than the whole suite.

**Constrains.** A later slice whose scenario needs an empty list has
to meet the same problem. The handoff carries it as open.

## D20 `GET /todos` ignores its query in slice 2

**Decision.** In slice 2, `GET /todos` lists every todo and ignores
the query. Rejecting a query (422, `completed`) arrives with the
filter in slice 8 (deviation 6), together with the one query it
accepts.

**Reason.** Do not build ahead (handoff 03). The PRD's query rule is
about the filter.

**Constrains.** Slice 8 adds query validation to `getTodos`.
