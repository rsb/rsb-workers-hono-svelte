# The api story

How the todo api is put together, told in the order a request meets
it. Each chapter covers one part. Chapters start thin and fill in as
features need them. Each ends with what is still open.

The decisions behind this story are:
- R1–R9, in
  [drafts/2026-10-30-02-slice-1-decisions.md](drafts/2026-10-30-02-slice-1-decisions.md);
- S1–S2, in the same draft;
- D1–D20, in
  [drafts/2026-10-31-04-slice-2-decisions.md](drafts/2026-10-31-04-slice-2-decisions.md);
- A1–A9, agreed with the owner after slice 2 (2026-10-31). They are
  recorded in this story first, and the stage's decisions draft
  follows:
  - A1: apps deliver and packages hold; `package.json` enforces the
    layers (chapter 0).
  - A2: operations live in packages (chapter 6).
  - A3: a contract is its own package, published by its provider
    (chapter 11).
  - A4: a contract holds endpoints with narrowed error kinds, and no
    client (chapter 11).
  - A5: the system is closed, so compatibility is deploy skew
    (chapter 11).
  - A6: the BFF is a bff-api and a frontend, and the bff-api follows
    this story (chapter 12).
  - A7: a client for another of our systems is data (chapter 8).
  - A8: each boundary translates once (chapter 5).
  - A9: names, and what `internal` means (chapter 0).
  - A10: everything stays in construct, as granular builders composed
    into one default chain; tests may enter at any level (chapter 4).

After slice 2 (Add and list), the code follows chapters 1–10
throughout, except for config, which has nothing to hold yet
(chapter 3).

A1–A9 change where the code lives and how the api's architecture
reaches past the api. Since refactor A the code has their layout,
but not yet the rest. Paragraphs marked **Target.** describe what they
ask for. Three refactors get the code there:
- **Refactor A, the move:** done (`a6676cd`). Apps and packages took
  the layout of chapter 0. Behaviour did not change, and tests changed
  only their import paths
  ([report](reports/2026-10-31-05-refactor-a-move.md)).
- **Refactor B, the BFF:** the BFF takes the api's architecture
  (chapter 12), with the contract's endpoints (chapter 11) and the
  api client in data (chapter 8).
- **Refactor C, construct:** the api's construct splits into granular
  builders (A10, chapter 4). Behaviour does not change. It could run
  before B; the order is the owner's call.

Chapter 0 and chapters 11–12 are new. They are numbered so that
references to chapters 1–10 elsewhere in the logbook stay correct.

Paths are under `apps/api/src/`. Business, operations and data are
packages under `packages/` (chapter 0).

```
apps/api/src/
├─ index.ts            the story
├─ construct.ts        builds everything, once per isolate
├─ http.ts             our HTTP module: drives Hono
└─ app/handlers/       entry points
packages/
├─ operations/         the work
├─ business/           types, rules, Result
└─ data/               one package per real thing
```

## 0. Where the api lives

The api is one system in a closed system: the monorepo. Everything
that calls it, and everything it calls of ours, is in the same
repository and ships from it. "Internal" in this story means *inside
the closed system* (A9).

### Apps and packages

The monorepo has two kinds of workspace (A1):

- **Apps** are how the business is delivered. Each app is one
  deployable: the api (HTTP), the BFF (pages). An app composes
  packages. It does not own them.
- **Packages** hold what more than one app, script or CLI may need:
  business, operations, data, and the contracts between systems.

Business, operations and data move out of the api into packages. What
stays in an app is its composition zone (`index.ts`, config,
construct, the HTTP module) and its handlers, because handlers are the
delivery.

Each package declares its dependencies in its own `package.json`. The
layering of chapter 9 then holds at the package boundary too: a
package that does not list another cannot import it, and pnpm makes
that a failure rather than a convention.

**Target.**

```
apps/
├─ api/                   deployable: the api
└─ bff/                   deployable: bff-api + frontend (chapter 12)
packages/
├─ contract/
│  ├─ api/                published by the api, consumed by the bff-api
│  └─ bff-api/            published by the bff-api, consumed by the frontend
├─ business/
├─ operations/
└─ data/
   ├─ memory/             the api's storage today
   └─ internal/
      └─ api/             client for the api, used by the bff-api
```

Refactor A (`a6676cd`) moved the code from `apps/todo/{api,web,contract}`
into this layout. Everything in the tree exists except
`contract/bff-api` and `data/internal/api`:

| Before | Now |
|---|---|
| `apps/todo/api` | `apps/api` |
| `apps/todo/web` | `apps/bff` |
| `apps/todo/contract` | `packages/contract/api` |
| `api/src/app/business` | `packages/business` |
| `api/src/app/operations` | `packages/operations` |
| `api/src/app/data/memory` | `packages/data/memory` |

Refactor B adds `packages/data/internal/api` (from the BFF's
`lib/server/api/`) and `packages/contract/bff-api`.

Under `data/`, each real thing is its own workspace package. `data/`
and `data/internal/` are directories, not packages, until something
must be shared through them (chapter 8).

### Names

The names follow four rules (A9):

- **No product namespace.** The monorepo is "todo", so nothing inside
  it is called todo: `apps/api`, not `apps/todo/api`.
- **Role names, while there is one of each.** `api` and `bff` say what
  the deployable is for. A name taken from today's feature ages badly:
  the owner turned down `list` as "one ticket away from being stale".
- **Who names what:**
  - an app directory names the deployable;
  - a contract names the system that publishes it (`contract/api`);
  - a data client names the system it reaches (`data/internal/api`),
    as `data/stripe` would name Stripe.
- **No protocol in an identity.** `api`, not `http-api` or `rest-api`.
  The protocol can change without a rename.

`internal` groups the clients for our own systems, so they are not
mistaken for vendors beside them. It never means *private to a
package*, as Go's `internal/` does. Privacy, if a package needs it,
uses something else, such as subpath `exports` (chapter 9).

**Open.**
- The npm scope: `@todo/…`, as today, or an org-wide scope. Claude's
  default for refactor A is `@todo/…` (`@todo/contract-api`,
  `@todo/business`, `@todo/data-memory`).

## 1. Startup

Startup has two halves:

- **Once per isolate**, before the first request: load config,
  construct everything, wire it to the HTTP layer.
- **On each request**, until an entry point takes over: the
  middleware that every request passes through.

The boundary between the two halves is explicit in the code. Anything
built once is built in the first half, and nothing in the second half
builds what the first half could have.

In the code:
- The first half is the module body of `index.ts`: `construct()`,
  then `serve(…)`. Both run once, when the isolate loads the module.
- The second half is whatever `serve` registers with `app.use`. Today
  that is only the body limit, which runs before routing so that an
  oversized body is a 413 on any path (D16).

Whatever the first half builds lives as long as the isolate. The
todos are part of that: they survive a reload and are lost when the
Worker restarts (deviation 3). `wrangler dev` runs one isolate, which
is all the lab has. With more than one isolate, each would hold its
own list (D15).

**Open.**
- What the per-request half contains beyond the body limit.
- Where middleware lives once there is middleware of our own. The
  owner suggested "middle", and Claude suggested `middleware`.

## 2. `index.ts`

`index.ts` is where the story is read, top to bottom: load config
(and handle its failure), construct, wire. It delegates every step and
does nothing itself.

Hono is not the vocabulary of the story. `http.ts`, our own module,
offers `serve(api)`, which takes everything construct built and drives
Hono's configuration behind it:
1. registers the per-request middleware;
2. registers each route from the route table;
3. registers the not-found handler;
4. registers the error handler.

`http.ts` also exports the types `Api` and `Route`, which describe
what construct must hand it.

Today the story has two steps, because there is no config:

```ts
const api = construct();
export default serve(api);
```

`http.ts` sits in the composition zone. Handlers do not import it.
They take Hono's own types (`Context`) from `hono` (D3).

**Open.**
- Config failure at module load: the Worker fails to start, callers
  get Cloudflare's error rather than our envelope, and deploy rejects
  the script. The story should say how `index.ts` handles this once
  config exists.

## 3. Config

Config is the first thing processed. It:

1. Checks that every environment value exists and has the right shape.
2. Puts the values into our own object shape.
3. Freezes the result. Config changes only with a deploy.

Only `index.ts` and construct import config.

Facts that are not environment values do not belong to config:
- Wire facts, which both sides check, belong to contract:
  `BODY_LIMIT_BYTES` and `TITLE_MAX`.
- Business facts belong to business: `TODO_LIMIT`.

The api reads no environment value yet, so there is no config package.
It arrives with the first environment value (D9).

## 4. Construct

Construct knows how to build every object and its dependencies,
entry points and routes included, from a fully loaded config. It
copies config values into whatever needs them. Nothing else sees
config.

Only `index.ts` and tests import construct, which keeps the import
graph acyclic (A10).

### Everything stays in construct (A10)

Building the app's dependencies is construct's whole job, and all of
it lives in one place: the app's construct. No other package carries
wiring:
- No shared `packages/construct`. Today one app builds operations, so
  there is nothing to share. A shared builder would also have to pick
  a store, and so depend on every data package.
- No builders in the packages they build. `packages/operations` holds
  operations and their ports, never a `todoOperations(deps)` that
  wires them.

When a second app needs the same graph, the question is reopened with
a real case in hand.

### Granular builders, composed

Construct is not one function. It is one builder per level, each
taking the level below as its argument and each exported:

```ts
constructInfra(): Infra                     // the store, the id source; later, from config
constructOperations(infra): Operations      // each operation with the ports it declares
constructRoutes(operations): Route[]        // each handler with the operation it runs
constructApi(routes): Api                   // plus the failure handlers, typed by http.ts
construct(overrides?: Partial<Infra>): Api  // the default chain, which index.ts calls
```

`construct()` is
`constructApi(constructRoutes(constructOperations({ ...constructInfra(), ...overrides })))`.

Any caller can enter at any level and replace one piece, which is
what makes construct usable for more than production:
- a seeded store: `construct({ store })`, so a test reaches the todo
  limit without 100 POSTs;
- a fixed id: `construct({ newId: () => "id-1" })`, so a test asserts
  the whole reply;
- one stubbed operation:
  `constructRoutes({ ...constructOperations(infra), listTodos: failing })`,
  so a test reaches `onError` through real routing.

The existing integration tests still go through the Worker's default
export, so the production path stays covered.

**One file while it reads at a glance.** The modularity is in the
exported functions, not in files. `construct.ts` reads top to bottom
as the app's whole dependency graph. It becomes a `construct/`
directory when it stops reading at a glance, most likely when config
arrives or a second domain does. The split is then likely by domain
(`construct/todos.ts`), since a new domain adds a builder at every
level.

**Target.** The code still has one `construct()` that does all levels
inline. Refactor C, after refactor B, splits it into the builders
above. Behaviour does not change.

In the code today (`construct.ts`), construct:
- builds one memory store and one id source (`crypto.randomUUID`);
- builds each operation with the dependencies it declares
  (`addTodo({ store, newId })`, `listTodos({ store })`);
- builds each handler with the operation it runs
  (`postTodos(addTodo)`);
- returns the route table and the three failure handlers, typed by
  `http.ts`'s `Api`.

The same store goes to both operations. That is how an add is seen by
the next list (D15). Construct may import `http.ts` for types only,
so a typo in the route table fails here (D3).

Construct is where interfaces meet. The data package does not know
the operations' interfaces, and the operations do not know the data
package. TypeScript checks that the one fits the other at the point
where construct hands it over (D5).

**Open.**
- Whether each handler needs a constructor. Today only handlers with
  something to inject have one (D8).

## 5. Entry points

Entry points live in the `handlers` layer. They pick up where the
per-request half of startup leaves off. Each one meets the expectation
of the api route aimed at it, and follows one template with four
duties:

1. **Validate:** turn unsafe input into validated, well-defined shapes.
2. **Operate:** run the operations it exists for.
3. **Handle errors:** from input, from operations and from
   presentation.
4. **Present:** convert the operation's result into the expected
   presentation.

Validation, operations and presentation are delegated, so the
template itself has no reason to change.

`postTodos` is the first entry point with all four duties:

```ts
export const postTodos = (addTodo: AddTodo) => async (c: Context) => {
  const input = await readJson(c, AddTodoBody);
  if (!input.ok) return failure(c, "validation", input.error.message, input.error.field);

  const added = addTodo(input.value.title);
  if (!added.ok) return failure(c, "limit", "the list is full");

  return success(c, presentTodo(added.value), 201);
};
```

The duties are delegated to these places:
- **Validate:** `handlers/validate.ts`. `readJson(c, schema)` reads the
  body and parses it with a contract schema. It returns
  `Result<…, { field, message }>` and never throws. Errors on the
  request path stay values from the first byte (D4).
- **Operate:** the operation construct injected.
- **Handle errors:** in the template itself. Each business error is
  mapped to an envelope kind by name (`full` → `limit`). This is the
  only place a business word meets a wire word (D10).
- **Present:**
  - `handlers/present.ts` builds the envelope (`success`, `failure`);
  - `handlers/todos/present.ts` maps a business `Todo` to contract's
    `TodoReply`, copying the fields by name. A business field reaches
    the wire only when someone adds it there (D2).

Contract is the wire. In the api, only the handlers layer and
`http.ts` import it (D1).

**Target.** Handlers stay in the app, because they are the delivery.
They import the operations, business and contract packages. The rule
"only handlers and `http.ts` import contract" becomes a rule about
the provider's side of a contract (chapter 11).

The handler's error mapping is one step in a chain. Each boundary
translates once, and no boundary passes on a word it did not define
(A8):

| Boundary | Translates | Example |
|---|---|---|
| api operation | returns a business error | `{ kind: "full" }` |
| api handler | business → wire | `full` → `limit` |
| bff-api data client | wire → business | `limit` → `{ kind: "full" }` |
| bff-api handler | business → page | `full` → a form status and message |

The client adds the one error the api cannot report:
`{ kind: "unavailable" }`, for a network failure, an unexpected status
or a reply that does not decode (chapter 8).

Entry points share logging and telemetry with middleware. Startup and
construct create entry points and inject their dependencies.

**Open.**
- Logging: `onError` still calls `console.error` directly (F5).
- `onError` turns an `HTTPException` into a 500. After D4 nothing on
  the request path throws one.

## 6. Operations

Operations do the work. Entry points use them.

Operations import business directly. They never import data.
Instead, an operation declares the interface it needs, and construct
injects the data package that satisfies it. The store's interface is
owned by the operation that uses it, not by data.

Each operation declares the smallest interface it needs, in its own
file (D5):
- `addTodo` needs `AddStore`: `count` and `add`.
- `listTodos` needs `ListStore`: `list`, "in the order they were
  added".

There is no shared `TodoStore`. Two operations that need the same
method each say so.

An operation that can fail returns a `Result` with a business error
(`addTodo` returns `{ kind: "full" }`). One that cannot fail returns
its value (`listTodos`) (D10). An operation also gets anything
impure injected, such as the id source (D13).

The store ports are synchronous because the store is in memory. That
makes `addTodo`'s check-then-add exact: no other request can run
between the count and the add (D14). An async store would reopen this
question, and the PRD puts concurrency out of scope.

**Target.** Operations live in packages, so that anything that
delivers the business can run them: the api, a tooling script, a CLI
(A2). The owner's preference is that every operation lives there, with
a rule that says who may use each one.

Claude's refinement, which the owner has not yet settled:
- An operation that needs only business and the ports it declares goes
  in `packages/operations`.
- An operation that needs the delivery itself stays in its app. The
  BFF's `loadTodos` and `addTodo` today call the api, so they belong
  to the bff-api (chapter 12).

Refactor A moves `operations/todos/` as it is: `add-todo.ts` and
`list-todos.ts`, each with its port.

The hazard is that a package of operations can be imported by any app,
so the BFF could run `addTodo` against its own store and bypass the
api. The owner judged it minor: "easy to spot and we can write rules
to prevent that". The api stays the one authority for adding a todo.
Ways to enforce it:
- a subpath export per operation (`@todo/operations/todos/add-todo`);
- an allow-list of operations per app;
- a lint rule or import scan in `pnpm check`.

**Open.**
- What happens to the ports, and to the cap's exactness, when a store
  needs `await`.
- Operations in depth. The owner: "we have not gone into operations
  yet." To settle:
  - the package layout (one `operations` package, or one per area);
  - the usage rule and how it is enforced;
  - how the bff-api's operations differ from the api's.

## 7. Business

Business is business types, behaviour (interfaces) and pure logic
only. It has no db, io, network or api calls.

Anything may import business. Business imports none of our other
packages, contract included (D1).

In the code:
- `business/todos/todo.ts` holds:
  - `Todo`: the api's own type, separate from the wire's `TodoReply`
    (D2);
  - `TODO_LIMIT`: 500, a rule about the list (D14);
  - `newTodo(id, title)`: a new todo is not completed (D13).
- `business/result.ts` holds `Result`, `ok` and `err`. Every layer
  that returns or reads a `Result` can reach it (D10).

Business does not check the title. Contract defines the title rule,
the handler applies it, and the operation receives a valid title (D1).

**Open.**
- Whether `Result`, which is not about todos, should get a home of its
  own if more such helpers appear.

## 8. Data

Data is the concrete world, one package per real thing: a database, a
vendor such as Stripe. A data package takes business objects, maps
them to its own internal representation (a row, a vendor payload) and
back. The same business object can live in several data packages.

Data imports business, nothing else of ours.

In the code, `data/memory/todos.ts` is the isolate's memory.
`memoryTodos()` keeps rows `{ title, completed }` in a `Map` keyed by
id:
- **Order:** a `Map` iterates in insertion order, so `list` keeps
  creation order without an order field.
- **Copies:** todos are copied in and out, so no caller can change
  stored state through an object it holds.
- **Interfaces:** it does not import or name the operations'
  interfaces. It returns a plain object that happens to satisfy both
  `AddStore` and `ListStore`, as a Go type satisfies an interface
  (D5).

Data makes no ids and checks no rules. It only maps (D13, D14).

**Target.** Each data package is a workspace package of its own under
`packages/data/` (A1). `data/memory` is the first.

Another system of ours is a real thing too. Calling the api from the
BFF is a concrete call over the network, so the client belongs in
data, as a Stripe client would (A7). It lives in
`packages/data/internal/api`:
- **Transport injected.** The client takes a `fetch`. Construct hands
  it the service binding in the BFF, plain `fetch` in a CLI, and the
  api's own `app.fetch` in integration tests.
- **Maps both ways.** It sends business values as the contract's
  request messages, and decodes every reply at runtime with the
  contract's schemas. It returns business values and business errors
  (chapter 5's chain), never envelopes.
- **One extra error.** Anything that is not a well-formed reply
  (network failure, unexpected status, a body that does not decode)
  becomes `{ kind: "unavailable" }`.

This changes the import rule for data:
- Data imports business, plus the contract of the system it talks to.
  Nothing else of ours.

`data/internal/` is where a shared `call` helper goes once a second
internal client needs one, not before. There is probably never a
`data/internal/bff-api`: the frontend reaches the bff-api through
SvelteKit's own transport (chapter 12).

**Open.**
- Who owns the port if a database package replaces the memory store
  (L5's second half).
- A contract test: each internal client run against the provider's
  real `app.fetch`, so client and provider cannot drift apart.

## 9. The shape of the code

### Two zones

The import rules differ in two zones:

- **Composition zone** (`index.ts`, config, construct, `http.ts`).
  Privileges come from an explicit allow-list:
  - `index.ts` imports config, construct and the HTTP module.
  - construct imports config and anything it builds, plus the HTTP
    module's types (D3).
  - tests may import construct, at any of its levels (A10).
  - the HTTP module imports contract and nothing else of ours.
  - config imports nothing of ours.
  - nothing imports `index.ts`.
- **Hierarchy zone** (`app/`). The hierarchy rules below apply.

The composition zone sits at the top of `api/src`. The hierarchy zone
lives under `app/`, beside it. Position alone decides which rules
apply, as with Go's `cmd/`.

### Hierarchy

- **A package is a directory.** The files directly in it are the
  package and may import each other. Its subdirectories are its
  children (S1, D5).
- **Across layers**, the allowed edges point down, may reach any
  depth, and may skip a layer (D6):

  ```
  handlers → operations → business
  handlers → business
  data → business
  ```

  Nothing imports handlers or data except construct.
- **Within a layer**, packages are hierarchical: general at the root,
  specific at the leaves. A child imports its ancestors. A parent
  never imports its children. Sibling packages never import each
  other. They share through their parent (D5).
  - Example: `handlers/todos/` imports `handlers/present.ts` and
    `handlers/validate.ts`.
- **Layout is the hierarchy**, as in Go: a file's directory says what
  it may import.
- **Depth** is counted from the layer directory as level 1. Four is
  the norm, five only when really needed, never six. A level-5
  package starts with `// depth 5: <reason>` (D7). Slice 2's deepest
  package is at level 2.
- **Third-party imports** are outside these rules, with one limit:
  `hono` is imported only by `http.ts` and the handlers (D3).

All of this can be checked exactly by an import scan.

**Target.** The rules survive the move to packages. What changes is
where they are enforced (A1):
- The **composition zone** stays in each app, at the top of its
  `src/`.
- The **layers** become packages. An edge between layers is a
  dependency in `package.json`, so pnpm refuses an edge that is not
  declared. The hierarchy rules still hold inside each package.
- The **edges** gain contracts (A3, A7):

  ```
  handlers   → operations → business
  handlers   → business
  handlers   → contract     (the provider's own contract)
  data       → business
  data       → contract     (the contract of the system it reaches)
  ```

  Business imports nothing of ours, contract included. A contract
  imports nothing of ours either.
- **Within an app**, handlers keep the hierarchy rules as a directory
  tree.
- **In the BFF**, SvelteKit decides which files are routes. The rules
  apply to routes by file suffix and to `$lib` by directory
  (chapter 12).

**Open.**
- How privacy is shown without Go's `internal/`. A9 settles half of
  it: `internal` means *inside the closed system*, never *private*, so
  the name is not available for privacy. If a package needs privacy,
  subpath `exports` can hide what it does not list.

## 10. Object style

Objects follow Rust and Go, not Java:

- data types and functions
- composition over inheritance
- small interfaces declared by the code that uses them
- constructor functions
- errors as values

A unit with dependencies is a function that takes them and returns
the function, or plain object, that does the work (D8):

```ts
export const addTodo =
  (deps: { store: AddStore; newId: () => string }): AddTodo =>
  (title) => { … };
```

The type of what it returns is named after it (`AddTodo`). The code
has no classes and no `this`, so nothing loses its binding when Hono
receives a handler. A unit with nothing to inject is a plain value
(`getHealth`).

**Open.**
- Naming: the operation is `addTodo` and its handler is `postTodos`,
  after the route, as `getHealth` is. Whether handlers should be
  named after their route or their operation.

## 11. Contracts

A contract is what one system publishes so that others can call it.
`contract/api` is the api's. It is a package of its own in
`packages/`, not part of the api, so that the endpoint is not coupled
to its consumers (A3).

### Who depends on whom

Provider and consumers both depend on the contract. Neither depends
on the other. This is dependency inversion across systems:
- **Inside a process**, the consumer owns its ports: an operation
  declares the store interface it needs (chapter 6).
- **Across the network**, the provider publishes. Many consumers call
  one api, and the api cannot own a port per consumer. The contract is
  the port, published once.

Only these import a contract:
- the provider's handlers and its HTTP module (D1);
- the consumers' data clients (chapter 8).

**Target.** Each contract says who consumes it, in its README or
`package.json` description, so that a change shows who it reaches.

### What a contract holds

Today `contract` holds (D1, D4):
- **messages**: the request and reply shapes (`AddTodoBody`,
  `TodoReply`, `TodoListReply`, `HealthReply`) as valibot schemas;
- **boundary input rules**: the title rule (`Title`);
- **wire limits**: `BODY_LIMIT_BYTES`, `TITLE_MAX`;
- **error vocabulary**: the envelope's kinds (`validation`, `limit`,
  …) and the `Envelope` shape;
- **runtime decoding**: the same schemas parse the request in the api
  and the reply in the client.

**Target.** It also gets endpoints (A4). An endpoint is plain data:
- method and path;
- the input schema;
- the reply schema;
- the error kinds this endpoint can return, narrowed from the full
  vocabulary.

Narrowing the kinds lets a consumer switch on them exhaustively:
`POST /todos` can fail with `validation` or `limit`, and TypeScript
says so. Today both sides hard-code the path `"/todos"`, and nothing checks
that a switch on an error kind is exhaustive (review tour §8).

A contract holds no client. A client is the consumer's concrete call,
so it lives in the consumer's data (chapter 8). The consumer derives
the types it sends from the schemas (valibot's `InferInput`).

### Which rules go in a contract

- **Shape rules** go in the contract. Anyone can check them with the
  message alone: a title is 1–256 characters.
- **Stateful rules** stay in business. They need state that only the
  provider has: the 500 cap. The contract only names the outcome
  (`limit`).

Validation has one authority. The contract defines the rule, and the
api enforces it. A consumer may apply the same rule early, for a
better form, but the api never trusts that it did.

The messages in a contract become the words consumers show, unless a
consumer replaces them. Putting a message in the contract is choosing
shared UI wording.

### Compatibility

The system is closed (chapter 0), so the contract has no outside
users and no versioning (A5). Compatibility reduces to deploy skew: for a
short time, a new bff-api can talk to an old api, or the reverse. A
change to a contract must survive one deploy in either order. The
consumer decodes every reply at runtime, so a skewed reply becomes
`unavailable` rather than a wrong value.

**Open.**
- How a deploy is ordered when a change cannot survive skew.

## 12. The BFF on the same architecture

The BFF is two things in one deployable (A6):
- **the bff-api**, the server half: loads, actions, server routes and
  hooks;
- **the frontend**, the half that runs in the browser.

The bff-api is an api, and it follows this story: handlers,
operations with ports, construct, data. Loads and actions are its
handlers, and each has the four duties of chapter 5. Calling the api
is its data (`data/internal/api`, chapter 8). The bff-api never runs
the api's `addTodo`: adding a todo has one authority, and it is the
api.

The bff-api publishes `contract/bff-api` for the frontend: the shape
of page data and of action results. The frontend reaches it through
SvelteKit's own transport, so it needs no data client.

### SvelteKit interleaves the two halves

The two halves are not separate directory trees. SvelteKit decides by
file name and by directory:

| Half | Files |
|---|---|
| bff-api | `+page.server.ts`, `+server.ts`, `hooks.server.ts`, `$lib/server/` |
| frontend | `+page.svelte`, `+layout.svelte`, the rest of `$lib` |

SvelteKit already refuses a client import of `$lib/server`. The
hierarchy rules work with that:
- in `src/routes/`, a file's half is decided by its **suffix**;
- in `$lib`, by its **directory**.

[The BFF story](the-bff-story.md) was the first pass at this, before
A6. Its chapters 4, 6 and 8 describe what refactor B replaces:
no construct, no operations, and envelopes returned from
`lib/server/api/`.

**Open.**
- What the frontend is, defined in the same terms: its layers, its
  ports and its rules.
- Whether one architecture story should replace this story and the
  BFF story, with a short page per app. Claude suggested it.
