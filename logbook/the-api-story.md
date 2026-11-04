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
- DB1–DB11, stage 06 (a database), in
  [drafts/2026-10-31-06-database-decision.md](drafts/2026-10-31-06-database-decision.md),
  as the owner's review changed them. The review and its numbered
  items are in
  [reports/2026-11-02-06-database-review-tour.md](reports/2026-11-02-06-database-review-tour.md).
  Its lessons are told where they apply:
  - bindings are not config (chapter 3);
  - one flat `DbStore`, with ports declared by the operations
    (chapters 4, 6 and 8);
  - the store reports facts and the operation decides what they mean
    (chapter 6);
  - a data package in three layers: Stmt, Raw and Outer (chapter 8);
  - one failure type for every layer, named once at its root
    (chapter 13);
  - handlers that read as a story (chapter 5).
- L1–L13, agreed with the owner in the language session
  (2026-11-03). Each term is defined in the
  [glossary](glossary.md):
  - L1: business states rules, the operation enforces them, and the
    store keeps the operation's decision atomic and answers with facts
    (chapters 6 and 7).
  - L2: the boundary is the chain: startup → entry point → operation
    (using business) → port ← data, wired by construct. Checked imports
    and tests keep it, not encapsulation.
  - L3: business objects with identity are entities, named plainly
    (`Todo`, never `TodoEntity`) (chapter 7).
  - L4: an entity's behaviour is pure business logic and lives beside
    the entity. Operations compose it. Anything that happens to an
    entity happens only in an operation. A different result is a new
    operation (chapters 6 and 7). It said "outcome" until L15.
  - L5: we use no aggregate. The operation does its job (chapter 6).
  - L6: both seams are shaped by the caller, and ports couple to
    business types by design (chapter 6).
  - L7: the store is engine-neutral. Its promise is atomicity. Supabase
    (Postgres) is the target, and D1 is one engine (chapter 6).
  - L8: value objects are adopted, and rare. A value earns one when
    it could be confused with another, is made of parts that belong
    together, or has behaviour of its own; a rule alone does not. One
    value object per whole concept: money, not amount and currency
    (chapter 7).
  - L9: the anti-corruption layers are the inbound translations. The
    contract is the published language, and presenting translates into
    it (chapters 5 and 8).
  - L10: `Title` is not a value object. It is a property, validated
    against the business rules at the entry point (chapters 5 and 7).
  - L11: performance is a design input. A DDD concept is taken only
    when it costs nothing at run time or pays for what it costs: one
    intent per port, plain types rather than hydrated objects, one
    translation per boundary.
  - L12: validate once. The entry point validates against the wire
    shape and the business rules and builds the input shape.
    Everything below it trusts what it receives (chapter 5).
  - L13: a port may carry out behaviour for its operation. When
    performance moves behaviour away from where it would otherwise
    live, a comment there says what moved and why (chapters 6 and 8).
- L14–L21, agreed with the owner in the operations session
  (2026-11-03):
  - L14: an operation is a business use case, driven by its spec. A
    light operation is fine: a use case that only reads still has one.
    The spec's form, and how use cases enter rsb-workflow, are parked
    (chapter 6).
  - L15: an action is a port method, an effect is a change in the
    world, and the result is the one thing an operation or process
    returns. An operation may have several effects. "Outcome" is
    retired (chapter 6).
  - L16: the operation marks its transaction scope, and the port does
    the work: begin, commit, and roll back when the work returns a
    failure. Only one store's actions run inside it. A single intent
    action stays available for performance (L13) (chapter 6).
  - L17: an external effect is inline (after the commit, best effort)
    or recorded (an outbox row inside the transaction, delivered at
    least once). The spec chooses, and says whether a failed inline
    effect fails the result (chapter 6).
  - L18: a process composes operations. It holds their order,
    dependencies and failure policy, returns one result, never touches
    a port and enforces no rule. It runs immediate or durable, as its
    spec chooses. Processes do not call processes, and operations do
    not call operations (chapter 6).
  - L19: a handler runs exactly one unit: an operation or a process.
    Never both, never neither (chapter 5).
  - L20: probes check the Worker and its dependencies. They run no
    unit, declare probe ports of their own, and live in `app/probes/`.
    `errors/` moves up to `app/`, shared by handlers and probes
    (chapters 5 and 9).
  - L21: the BFF never runs a backend operation. Its own operations
    are UI concerns: aggregation, filtering. They wait for the BFF
    story (chapters 6 and 12).
- L22, agreed with the owner in the layout session (2026-11-03):
  operations and processes each have one package, with a folder per
  area. A process imports operations' types only. An area splits into
  its own package only by recorded exception. Any area's business
  objects may be used by an operation or process; entities refer to
  other areas' entities by id (chapters 0, 4, 6 and 9).
- L23, agreed with the owner in the OpenAPI session (2026-11-03):
  the api's contract is documented as OpenAPI, for backend apis only.
  The document is generated from our code, and no code is generated
  from it. OpenAPI's operation is our route, an entry point at a
  method and path; we never call it an operation (chapter 11).
- L24, agreed with the owner in the entry chain session (2026-11-03):
  the chain is renamed the entry chain ("entry-chains" in names).
  Construct is the map and a path names its layer and area, so any
  entry chain can be followed without a search. An entry chain is
  written in one line of symbols, `→` for a call and `⇢` across a
  port. Every entry point's entry chain is listed in
  `apps/api/entry-chains.md`, which is generated only (chapter 9).
- L25, agreed with the owner in the use case session (2026-11-03):
  a use case is written before the code, at
  `prd/<app>/use-cases/<area>/<name>.md`, extending handoff 00's
  `prd/<app>.md`. It is the spec L14 asks for, and it may use
  technical language. Each is realized by exactly one unit, whose doc
  comment cites its path. Its name is a hint and a search key, not the
  unit's name (chapter 6).
- L26, agreed with the owner in the api spec session (2026-11-03):
  each api is defined in one markdown spec, `prd/<app>/api.md`,
  written at design time after the use cases. It defines every
  endpoint the api serves, probes included, in one form, and each
  endpoint cites the use case or requirement it serves. The contract
  and the OpenAPI document are generated from it and committed. This
  reverses L23 in part: the contract is now generated, while entry
  points and everything below them are still written by hand. The
  spec states every rule as data. A data spec for store calls is
  pending, to be tried (chapters 6, 8 and 11).

After slice 2 (Add and list), the code followed chapters 1–10
throughout, except for config, which has nothing to hold yet
(chapter 3). Stage 06 replaced the memory store with D1 and reworked
failures, handlers and ports. The chapters below describe the code
after stage 06.

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
- **Refactor C, construct:** done in stage 06 (`1542aac`), before B
  (DB11). The api's construct is split into granular builders (A10,
  chapter 4).

Chapter 0 and chapters 11–13 are new. They are numbered so that
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
├─ processes/          compositions of operations (L22, target)
├─ business/           types, rules, Result
├─ fail/               every failure our code can name (chapter 13)
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
├─ fail/
├─ operations/
├─ processes/             (L22)
└─ data/
   ├─ d1/                 the api's database, with its migrations
   └─ internal/
      └─ api/             client for the api, used by the bff-api
```

Refactor A (`a6676cd`) moved the code from `apps/todo/{api,web,contract}`
into this layout. Everything in the tree exists except
`contract/bff-api` and `data/internal/api`. Stage 06 added `fail` and
`data/d1`, and deleted `data/memory` (chapter 8):

| Before | Now |
|---|---|
| `apps/todo/api` | `apps/api` |
| `apps/todo/web` | `apps/bff` |
| `apps/todo/contract` | `packages/contract/api` |
| `api/src/app/business` | `packages/business` |
| `api/src/app/operations` | `packages/operations` |
| `api/src/app/data/memory` | `packages/data/memory`, deleted in stage 06 |

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
  `@todo/business`, `@todo/data-d1`).

## 1. Startup

Startup has two halves:

- **Once per isolate**, before the first request: load config (when
  there is any), construct everything from the bindings, wire it to
  the HTTP layer.
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

Whatever the first half builds lives as long as the isolate. Since
stage 06 that is only objects, never state: the `DbStore` holds the D1
binding and nothing else, and the todos live in D1. They survive a
restart, and every isolate sees the same list. Before stage 06 the
todos lived in the isolate's memory, so a restart lost them
(deviation 3) and each isolate would have held its own list (D15).

The first half does no I/O. Workers forbid it at module scope, and
nothing needs it: building the store only keeps the binding, and
prepares no statement. A store whose creation needs I/O (a Postgres
pool, a D1 session per request) reopens this (review item 30).

**Open.**
- What the per-request half contains beyond the body limit.
- Where middleware lives once there is middleware of our own. The
  owner suggested "middle", and Claude suggested `middleware`.

## 2. `index.ts`

`index.ts` is where the story is read, top to bottom: load config
(and handle its failure), construct from the bindings, wire. It delegates every step and
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

Today the story has two steps, because there is no config. The
bindings come from `cloudflare:workers`, and construct takes them as
they are:

```ts
const api = construct({ db: env.DB });
export default serve(api);
```

`index.ts` does not check that the `DB` binding exists. The toolchain
already does: `wrangler types --check` fails `pnpm check` when the
binding and the generated types disagree.

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
- Wire facts belong to contract: `BODY_LIMIT_BYTES`.
- Business facts belong to business: `TODO_LIMIT` and `TITLE_MAX`
  (review item 38, chapter 7).

### Bindings are not config

Stage 06 first treated the D1 binding as config: `readConfig` checked
that `env.DB` was a D1 database, and construct read the store from
config (DB5). The owner's review turned that down (review item 34):

- **Config is data.** Plain values that vary by deployment, such as
  limits, URLs and flags. Our code reads them, checks them and freezes
  them.
- **A binding is a capability.** The platform hands it over already
  configured and built. There is nothing to read or check: the
  toolchain checks that it exists (chapter 2), and a broken database
  shows up as a query failure (chapter 13), or in a probe.

So bindings skip config and go straight to `constructInfra`, typed as
construct's `Bindings` (chapter 4). The only check of the database our
code will make is a readiness probe, one cheap query per call (review
item 35, L20, not built yet).

The api reads no environment value yet, so `config.ts` holds only a
comment saying this. Config arrives with the first environment value
(D9).

## 4. Construct

Construct knows how to build every object and its dependencies,
entry points and routes included, from the bindings and a fully
loaded config. It passes each binding and config value to whatever
needs it. Nothing else sees config or the bindings.

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
constructInfra(bindings): Infra             // the DbStore, the id source; later, config too
constructOperations(infra): Operations      // each operation with the ports it declares
constructRoutes(operations): Route[]        // each handler with the operation it runs
// target (L22): constructProcesses(operations): Processes, between the two,
// and constructRoutes(operations, processes), each handler with its one unit
constructApi(routes): Api                   // plus the failure handlers, typed by http.ts
construct(bindings): Api                    // the default chain, which index.ts calls
```

`construct(bindings)` runs the levels in order, naming each result:
infra, then operations, then routes, then the api.

Any caller can enter at any level and replace one piece, which is
what makes construct usable for more than production:
- a fake store and a fixed id:
  `constructOperations({ dbStore: fakeDbStore(), newId: () => "id-1" })`,
  so a test runs the whole route table with no workerd and asserts the
  whole reply (`construct.test.ts`);
- one stubbed operation:
  `constructRoutes({ ...constructOperations(infra), listTodos: failing })`,
  so a test reaches a failure through real routing.

The integration tests still go through the Worker's default export,
on a real local D1, so the production path stays covered.

Tests enter one level down rather than through `construct`, so
`construct` takes no overrides. It had an `overrides?: Partial<Infra>`
parameter until stage 06, when nothing used it any more (review
item 12).

**One file while it reads at a glance.** The modularity is in the
exported functions, not in files. `construct.ts` reads top to bottom
as the app's whole dependency graph. It becomes a `construct/`
directory when it stops reading at a glance, most likely when config
arrives or a second domain does. The split is then likely by domain
(`construct/todos.ts`), since a new domain adds a builder at every
level.

In the code (`construct.ts`), construct:
- types the bindings it takes: `Bindings = { db: D1Database }`;
- builds one `DbStore` from the D1 binding (`createDbStore(db)`) and
  one id source (`crypto.randomUUID`);
- builds each operation with the dependencies it declares
  (`addTodo({ dbStore, newId })`, `listTodos({ dbStore })`);
- builds each handler with the operation it runs
  (`postTodos(addTodo)`);
- returns the route table and the three failure handlers, typed by
  `http.ts`'s `Api`.

The running Worker always stores todos in D1. There is no runtime
switch between stores, and no second store kept for tests (DB4 as the
owner decided it: the memory store was deleted).

The same `DbStore` goes to every operation. That is how an add is seen
by the next list (D15). Construct may import `http.ts` for types only,
so a typo in the route table fails here (D3).

### The composition root

Construct is where interfaces meet, and the only place that does. The
data package does not know the operations' ports, and the operations
do not know the data package. Each operation declares the methods it
needs (chapter 6), and `d1` exports one flat `DbStore` with every
database method (chapter 8). Construct hands the whole `DbStore` to
each operation, and TypeScript checks there that it has every method
the operation's port asks for (D5). Each operation then sees only the
methods its port names.

This is dependency inversion with construct as the composition root.
Before stage 06 the same was true of the memory store. What stage 06
added is the single `DbStore`: one object per database, not one per
table or per operation, so construct passes one thing and does not
pick methods apart.

**Open.**
- Whether each handler needs a constructor. Today only handlers with
  something to inject have one (D8).
- A test that enters at `constructOperations` must fake the whole
  `DbStore`, not just the methods one test needs. With two methods
  that is a short array-backed fake. With hundreds it is too big, so
  whole-route-table tests may belong with the integration-testing
  session (chapter 8).

## 5. Entry points

Entry points live in the `handlers` layer. They pick up where the
per-request half of startup leaves off. Each one meets the expectation
of the api route aimed at it, and follows one template with four
duties:

1. **Validate:** turn unsafe input into validated, well-defined shapes.
2. **Operate:** run the one unit it exists for: an operation or a
   process (L19).
3. **Handle errors:** from input, from operations and from
   presentation.
4. **Present:** convert the operation's result into the expected
   presentation.

Validation, operations and presentation are delegated, so the
template itself has no reason to change.

Two of the duties translate (L9):
- **validate** is an anti-corruption layer: it turns a language that
  is not ours, the request, into business inputs;
- **present** translates outward, into the published language: the
  contract. The api serves that language as an open host service.

Validation happens once, here (L12). The entry point checks the wire
shape and the business rules, which it may import, and builds the
input shape from the result. A single property is checked as a
property: the title against `TITLE_MAX`, with no type of its own
(L10). Everything below the entry point trusts what it receives:
operations, ports and data do not check it again.

### One unit per handler (L19)

A handler runs exactly one unit: one operation or one process. Never
both, since sequencing operations is a process's job. Never neither,
since a route with no use case behind it is not an entry point. The
feature's spec decides which unit a handler runs. When a handler seems
to need two operations, that is a new use case: a new operation, or a
process.

### Probes and errors (L20)

Not every route is an entry point. A probe checks the Worker and its
dependencies, and completes no business task, so it runs no unit:
- **liveness:** is the Worker up? `health` is one, and it touches
  nothing;
- **readiness:** can the Worker reach what it needs? The probe
  declares a probe port of its own (`ping()`), which data satisfies
  with something cheap (`SELECT 1`). It never uses an operation's port
  or a business action.

Probes may be called often, so they stay cheap. For a paid or
rate-limited provider a probe checks configuration or the provider's
status, and never sends anything. A public probe answers up or down;
which dependency failed, and why, goes to the logs.

Errors (not found, on error) present failures for handlers and probes
alike, so they belong to neither.

**Target.**

```
apps/api/src/app/
├─ errors/     failure presentation, shared by handlers and probes
├─ handlers/   entry points: each runs exactly one operation or process
└─ probes/     checks of the Worker and its dependencies: no unit
   └─ health/health.ts
```

Today `health` and `errors` both sit under `app/handlers/`.

### The handler template

`postTodos` is the first entry point with all four duties. A handler
tells a story: each step is named, each `if` has braces, and a
comment says why the step is there (review item 36):

```ts
export const postTodos = (addTodo: AddTodo) => async (c: Context) => {
  // The body must be JSON, shaped as the contract says.
  const body = await validateBody(c, AddTodoBody);
  if (!body.ok) {
    return userFailure(c, body.error);
  }

  // The title must follow the business rules.
  const newTodo = validateTitle(body.value);
  if (!newTodo.ok) {
    return userFailure(c, newTodo.error);
  }

  // Adding can fail for the user (the list is full) or for us (the store).
  const added = await addTodo(newTodo.value);
  if (!added.ok) {
    return mapFailure(c, added.error);
  }

  const reply = presentTodo(added.value);
  return created(c, reply);
};
```

The duties are delegated to these places:
- **Validate:** in two steps, each returning `Result<…, Fail<"invalid">>`
  and never throwing. Errors on the request path stay values from the
  first byte (D4).
  - `handlers/validate.ts` holds what every handler shares.
    `validateBody(c, schema)` reads the body, parses it as JSON and
    checks it against a contract schema: the wire shape only.
  - `handlers/todos/validate.ts` holds what only the todos handlers
    need. `validateTitle` trims the title and applies the business
    rule (`TITLE_MAX`), and turns the body into a `NewTodo`.
  - One `validate.ts` per handler package, split only when it grows
    too large.
  - A function is named for the problem it solves, not for how it
    works: `readJson` became `validateBody` (review item 39).
- **Operate:** the operation construct injected. It now returns a
  promise, since the store is a database (chapter 6).
- **Handle errors:** with one of two calls, chosen by what the
  handler knows (chapter 13):
  - when the failure's kind is known, the explicit one:
    `userFailure` after validation, which can only fail as `invalid`;
  - when it is dynamic, as an operation's failure is, `mapFailure`
    resolves it to `userFailure` or `serverFailure` by kind.
- **Present:**
  - `handlers/present.ts` builds the envelope and is the only handler
    file that knows status codes: `success` (200), `created` (201),
    `userFailure` (4xx) and `serverFailure` (5xx). Handlers speak this
    presentation vocabulary, not HTTP (review items 40, 41).
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
| api data package | a driver error → a failure | D1's text → `unavailable` or `server` |
| api operation | a fact → a failure | "not inserted" → `limit` |
| api handler | failure kind → wire kind | `limit` → `limit`, `invalid` → `validation` |
| bff-api data client | wire → business | `limit` → `{ kind: "full" }` |
| bff-api handler | business → page | `full` → a form status and message |

Stage 06 changed the api's rows. Before it, the operation returned a
business error of its own (`{ kind: "full" }`), and the handler
translated it by name. Now the api has one failure type, `Fail`, with
a fixed set of kinds (chapter 13). The package that first meets a
failure names its kind, and the layers above only add context. The
handler's translation is a table in `present.ts`, checked by the
compiler for every kind. The bff-api's rows are refactor B's.

The client adds the one error the api cannot report:
`{ kind: "unavailable" }`, for a network failure, an unexpected status
or a reply that does not decode (chapter 8).

Entry points share logging and telemetry with middleware. Startup and
construct create entry points and inject their dependencies.

**Open.**
- Logging: `serverFailure` calls `console.error` directly, with the
  whole failure chain (F5). It moved there from `onError`, so every
  5xx is logged in one place.
- `onError` turns any throw, an `HTTPException` included, into a
  `server` failure and a 500. After D4 nothing on the request path
  throws one.
- Content type: a `text/plain` body holding valid JSON is accepted
  today (review item 37).

## 6. Operations

Operations do the work. Entry points use them, directly or through a
process.

### An operation is a business use case (L14)

"Use case" reads oddly in code, so the code says operation, but a
business use case is what it is. Each one is driven by its spec, which
states its intent, input, the rules it enforces, the action that
carries its decision and what it keeps atomic, its effects, its result
and its failures. The spec is the use case file (L25); how use cases
enter rsb-workflow is parked.

A light operation is fine. A use case that only reads still has an
operation: `listTodos` is one. It costs a function call, keeps "only
operations and probes call ports" free of exceptions, and gives logic
that arrives later (list *my* todos) a place to go. Its spec is a few
lines.

### Use cases are written before the code (L25)

A use case is written down before any code, beside the PRD it comes
from. The work runs in this order:

```
PRD → use cases → api spec → contract, OpenAPI (generated) → code → tests
```

The api spec is `prd/<app>/api.md` (L26, chapter 11).

- **Where.** `prd/<app>/use-cases/<area>/<name>.md`, filed by area as
  the code is (L22). This extends handoff 00's `prd/<app>.md`. The PRD
  is frozen, so a use case cites it and never edits it.
- **One unit.** Each use case is realized by exactly one unit, an
  operation or a process. The unit's doc comment cites the use case's
  path. The link is the citation, not a matching name.
- **The name** is a hint and a search key. It does not decide the
  unit's name.
- **The use case is the spec** L14 asks for. It is written for the
  developer, so it may speak of databases, transactions, concurrency
  and queues. Its contents split along the line between the business
  and the code:

| In the use case | In the unit |
|---|---|
| intent, and the PRD sentences it serves | the function, its type and its ports |
| input | the input type (`TodoPatch`) |
| rules, each citing the PRD | which entity function or port enforces each |
| what must hold together, and under concurrency | transaction scope or intent action (L13, L16) |
| effects, and whether each must be delivered | inline or recorded (L17) |
| result and failures | the `Result` type and `Fail` kinds |

A use case holds no code names. The entry chain index joins it to the
code: its `use case` row is the path the unit cites (L24).

### Actions, effects and the result (L15)

- An **action** is a method on a port: how an operation asks the world
  for one thing.
- An **effect** is a change the operation makes in the world: a row
  written, an email sent, a text sent.
- The **result** is the one thing the operation returns: a value or a
  failure.

An operation may use the actions of several ports, one per real thing
it touches (`{ dbStore, mailer, texter }`), and may have several
effects. It returns one result. The word "outcome" is retired, since it
meant both.

### Business states, the operation enforces (L1, L4, L5)

Each layer has one part in a rule:
- **business states it:** a type, a constant, a pure function
  (`TODO_LIMIT`);
- **the operation enforces it:** it applies the rule to a real case
  and decides the result (`addTodo` refuses the 501st todo);
- **the store keeps it atomic:** no other request lands inside the
  operation's decision, and the store answers with facts.

An operation is the only place anything happens to an entity. It
composes the entity's behaviour (`newTodo`) with its actions to
produce its effects and its result. A different result is a new
operation, which may reuse the same entity behaviour. Behaviour that
several operations need is shared as a pure function in business, not
turned into a new type. Operations do not call operations: a sequence
of operations is a process.

This is why we use no aggregate. In DDD an aggregate guards the rules
that span several entities. Here the operation does that, and the idea
survives as two questions every operation answers: which rules span
several entities, and what must the store keep atomic?

### Ports are shaped by the operation (L6)

Both seams are shaped by the caller. An entry point calls an
operation with business inputs, and an operation calls a port
declared for exactly what it needs. Ports speak business types, so
they are coupled to business on purpose. That is why we build in
vertical slices: each seam is made for the work that uses it.

Operations import business directly. They never import data.
Instead, an operation declares the interface it needs, and construct
injects the data package that satisfies it. The store's interface is
owned by the operation that uses it, not by data.

Each operation declares the smallest interface it needs, in its own
file (D5, DB2):
- `addTodo` needs `AddStore`: `addTodoUnlessFull(todo, limit)`,
  answered with whether the todo was inserted.
- `listTodos` needs `ListStore`: `listTodos()`, "in the order they
  were added".

There is no shared `TodoStore`. Two operations that need the same
method each say so. The methods are named for the whole app, not for
one table (`addTodoUnlessFull`, not `addUnlessFull`), because they all
live side by side in one flat `DbStore` (chapter 8). Each operation
takes it as `dbStore`, typed by its own port.

### Every port is async and returns a Result

A database answers later, so every port returns a promise (DB3), and
so does every operation. Every operation that touches a store can
fail, since the store can, so every operation returns
`Result<T, AnyFail>` (chapter 13). `listTodos` used to return its
value because nothing could refuse it. Now the database can fail, so
it returns a `Result` like the rest. An operation also gets anything
impure injected, such as the id source (D13).

### The cap is one atomic step behind the port

The memory store's ports were synchronous, which made `addTodo`'s
check-then-add exact: no other request could run between the count
and the add. An async store breaks that, since another add can
land between an awaited count and an awaited insert.

So the port asks for an intent, not two steps (DB1):
`addTodoUnlessFull(todo, limit)`. The store's promise is that the
intent is atomic: no other add lands between its count and its
insert (L7). How it keeps that promise depends on the engine:
- **D1 (SQLite)**, today: one SQL statement counts and inserts
  together (chapter 8). SQLite runs one write at a time, so the
  statement is atomic. D1 has no `BEGIN` to span two statements; a
  rule that needs several reopens this, with `batch()` (review
  item 29).
- **Postgres (Supabase)**, the target: one statement is not enough
  under READ COMMITTED, since two can count at once. It needs a row
  lock (`FOR UPDATE`), an advisory lock or a serializable
  transaction. Which ones are possible depends on how we reach it,
  which is open (chapter 8).

How much these cost, and which route allows which, needs experiments
before it is decided.

The port does not change between engines. The operation sees an
intent and a fact either way.

### The operation marks the transaction, the port runs it (L16)

An intent action is one way to stay atomic. The other is a
transaction scope: the operation marks where the transaction starts
and what rolls it back, and the port does all of the work. The
operation hands its work to the port. A sketch, not today's code:

```ts
type AddTodoTx = {
  countTodos(): Promise<Result<number, AnyFail>>;
  insertTodo(todo: Todo): Promise<Result<void, AnyFail>>;
};

type AddStore = {
  transaction<T>(
    work: (tx: AddTodoTx) => Promise<Result<T, AnyFail>>,
  ): Promise<Result<T, AnyFail>>;
};
```

```ts
const added = await dbStore.transaction(async (tx) => {
  const count = await tx.countTodos();
  if (!count.ok) {
    return count;
  }
  if (count.value >= TODO_LIMIT) {
    return limitReached("the list is full");
  }

  const todo = newTodo(newId(), input);
  const inserted = await tx.insertTodo(todo);
  if (!inserted.ok) {
    return inserted;
  }
  return ok(todo);
});
// External effects go here, after the commit.
```

The port:
- begins when `transaction` is called;
- commits if the work returns `ok`;
- rolls back if the work returns a failure, so the operation decides
  by returning, not by throwing;
- rolls back and reports a failure if anything throws.

Inside the work, `tx` is still the operation's smallest port (L6).
Only one store's actions run there; external effects never do. The
work stays short, since it holds locks across round trips from the
Worker. The spec states the isolation the operation needs: count, then
insert, is only safe if the transaction is serializable or locks the
right rows.

This puts the decision back in the operation: the limit is compared
in TypeScript, not in SQL. The intent action (`addTodoUnlessFull`) is
one round trip instead of three, with the decision carried out by the
store (L13). The spec says which one an operation uses.

D1 cannot offer a transaction scope: it has no interactive
transactions, only `batch()`, whose statements are all fixed before
any runs. Postgres can, over Hyperdrive with a driver that holds a
connection; PostgREST cannot, since its only atomic unit is a
database function. What a scope costs from a Worker needs experiments.

### External effects are inline or recorded (L17)

An email or a text cannot be rolled back, so it never runs inside a
transaction scope. Every external effect is one of two kinds, and the
spec chooses for each:

| | How | Guarantee | Can fail the result |
|---|---|---|---|
| **inline** | after the commit, the operation calls the action | best effort; the operation knows how it went | as the spec says |
| **recorded** | an outbox row, written inside the transaction | at least once, delivered later | no: it has not happened yet |

A recorded effect commits with the decision or not at all, so the gap
between "saved" and "sent" closes. A relay delivers the outbox rows
and marks them done. The relay is a process (below): its trigger, a
queue message or a cron sweep, is an entry point, and each delivery is
an operation. Delivery can repeat, so the outbox row's id is the
idempotency key, passed to the provider where it takes one.

Inline effects can run after the response (`waitUntil`), which saves
latency and loses the failure to the logs. The spec decides that too.

### Processes compose operations (L18)

Some use cases are several operations in an order: add a todo, then
email, then text. The write decides whether the others run. That is a
process: it composes operations, holds their order and their
dependencies, handles their failures as its spec says, and returns one
result.

```ts
export const addTodoAndNotify =
  (deps: { addTodo: AddTodo; emailTodoAdded: EmailTodoAdded; textTodoAdded: TextTodoAdded }): AddTodoAndNotify =>
  async (input) => {
    // The write decides: if it fails, nothing else runs.
    const added = await deps.addTodo(input);
    if (!added.ok) {
      return added;
    }

    // The notifications are independent, so they run together.
    const [emailed, texted] = await Promise.all([
      deps.emailTodoAdded(added.value),
      deps.textTodoAdded(added.value),
    ]);

    // Spec: a failed notification does not fail the result.
    return ok({ todo: added.value, notified: { email: emailed.ok, sms: texted.ok } });
  };
```

What keeps a process from becoming a second operation layer:

| | Operation | Process |
|---|---|---|
| Composes | entity behaviour and actions | operations |
| Touches ports | yes | never |
| Enforces business rules | yes | no: it decides flow (stop, continue, retry, compensate) |
| Atomic scope | one transaction or one intent action | none: each operation commits on its own |
| Returns | one result | one result |
| Spec | intent, rules, decision, effects, result | steps, dependencies, failure policy per step, mode, result |

Nothing is atomic across steps. Undoing a step is an operation of its
own, a compensation. And if the Worker dies between steps, the later
ones never run. So a process has two modes, and its spec chooses:
- **immediate:** inside the request, as above. It is fast and returns
  the whole result, but delivery is best effort;
- **durable:** the same steps on a runner that keeps each step's
  result and retries, such as Cloudflare Workflows. Every step runs,
  but the request cannot wait for all of them: it returns after the
  first, or returns "accepted". How a durable process runs on
  Cloudflare Workflows is a story of its own, the workflow story, not
  written yet. The process itself, its spec and its place in the entry chain
  belong here.

A process receives built operations from construct, not ports, so its
tests mock operations only. Processes do not call processes.

The name is DDD's process manager. "Workflow" was turned down because
rsb-workflow and Cloudflare Workflows already use it, "saga" because
it suggests compensation only, and "pipeline" because it suggests a
straight line.

**Target.** The todo app has no process yet. Since this story is the
template for every app on the stack, it needs one: "notify on add"
exercises a process, the outbox, a relay, retries and idempotency.

### A port may carry out behaviour (L13)

The cap is behaviour the store carries out for the operation, and it
is not the only one: the patch, mark all, clear completed and the
counts each run as one statement. That is a design choice, not a
compromise. The rule is still stated in business and the decision is
still the operation's; the port does the work in the place that does
it best.

When performance moves behaviour away from where it would otherwise
live, a comment at that spot says what moved and why, so the next
reader does not move it back.

### The store reports facts, the operation decides what they mean

The store answers `addTodoUnlessFull` with `true` or `false`: inserted
or not. It does not say why not, and returns no `limit` failure. The
operation decides: here, "not inserted" means the list is full, so
`addTodo` returns `limitReached("the list is full")`.

This keeps the business meaning in one place. If a second reason for
not inserting appears, the operation is the one place that changes,
and the data package stays a mapper.

A store failure is different: the operation does not decide its
meaning. The data package already named it `unavailable` or `server`,
and the operation only wraps it with what it was doing:
`wrap(failure, "add todo")` (chapter 13).

**Target.** Operations live in packages, so that anything that
delivers the business can run them: the api, a tooling script, a CLI
(A2).

Refactor A moved `operations/todos/` as it was. Today
`packages/operations` holds `todos/`, one file per operation with its
port, and every import names one operation's file
(`@todo/operations/todos/add-todo.ts`). Only the api depends on it.

The BFF never runs a backend operation (L21). Its own operations are
UI concerns, such as aggregation and filtering, and never touch a
database: they reach the api through its client. That removes the
hazard of the BFF running `addTodo` against its own store and
bypassing the api. The rule is that `apps/bff` never lists
`@todo/operations`, which one `package.json` check enforces. The BFF's
operations wait for the BFF story (chapter 12).

### Where operations and processes live (L22)

Each layer is one package with a folder per area:

```
packages/
├─ business/src/todos/todo.ts
├─ operations/src/todos/add-todo.ts
└─ processes/src/todos/add-todo-and-notify.ts
```

- **Processes are their own package.** `@todo/processes` lists
  `@todo/operations` and imports it with `import type` only, since
  construct hands a process its built operations. `@todo/operations`
  never lists `@todo/processes`, so pnpm refuses an operation that
  reaches for a process.
- **A process that spans areas** lives in the area of the use case
  that triggers it. "Add and notify" is a todos use case, even though
  it sends email.
- **Areas are folders, not packages.** An area becomes its own package
  only when a second app needs only some areas, a team owns it, or
  the package's check or test time hurts. The split is recorded as an
  exception with its reason. Moving is cheap: one import segment
  changes.
- **Data keeps its own axis:** one package per engine or external
  system, never per area (chapter 8).

Areas meet in the operation, not in business:
- An operation or a process may use any area's business objects.
  Edges across layers reach any depth (chapter 9), so
  `operations/todos/assign-todo.ts` may import
  `business/users/user.ts`. A rule that spans two areas' entities is
  the operation's job (L5).
- Within a layer, siblings never import each other: no business area
  imports another, and no operation imports another.
- An entity refers to another area's entity by id: a `Todo` holds
  `assigneeId`, not a `User`.

Another system's business objects are a different case: they are its
language, not ours. They are reached through its contract and an ACL
in data (L9), never imported. That case is open.

Construct gains one level, between operations and routes:
`constructOperations → constructProcesses → constructRoutes`
(chapter 4).

**Open.**
- Using another system's business objects: the contract, the ACL in
  data, and our own type for the concept.
- How use cases enter rsb-workflow (parked).
- Transaction scope on Postgres: the access route, the isolation each
  operation needs, and its latency from a Worker. It needs
  experiments, and decides whether D1 stays for the lab.

## 7. Business

Business states the rules (L1): types, constants and pure functions
only. It has no db, io, network or api calls, and it enforces nothing.
The words below are defined in the [glossary](glossary.md).

It holds:
- **Entities** (L3): business types with identity. `Todo` is one,
  known by its `id`. They are named plainly: `Todo`, never
  `TodoEntity`.
- **Entity behaviour** (L4): pure functions beside the entity, which
  operations compose. `newTodo` is one.
- **Value objects** (L8), rarely: types defined only by their value,
  never changed once made, and valid whenever you hold one. Each is
  made by a constructor that returns a `Result`, and in TypeScript it
  is a branded type. A value earns one when it could be confused with
  another, is made of parts that belong together, or has behaviour of
  its own. A rule alone does not earn one, since the entry point
  checks single properties (L12). One value object per whole concept:
  money, not amount and currency. The todo app has none yet.
- **Rules:** constants such as `TITLE_MAX` and `TODO_LIMIT`.

Anything may import business. Business imports none of our other
packages, contract included (D1).

In the code:
- `business/todos/todo.ts` holds:
  - `Todo`: the api's own type, separate from the wire's `TodoReply`
    (D2);
  - `NewTodo = { title }`: what someone asks to add. It is not a todo
    yet: it has no id and no completed flag;
  - `TITLE_MAX`: 256, the longest title after trimming;
  - `TODO_LIMIT`: 500, a rule about the list;
  - `newTodo(id, input)`: a new todo is not completed (D13).
- `business/result.ts` holds `Result`, `ok` and `err`. Every layer
  that returns or reads a `Result` can reach it (D10).

Business owns the title rule but does not apply it. The rule is a
business fact (`TITLE_MAX`), so the api and the BFF both import it
from business. Applying it is validation, which is a handler's job:
`validateTitle` in the api's handlers, and the same check in the BFF's
action. The operation receives a valid `NewTodo`. Before stage 06 the
contract held the title rule; now it holds only the wire shape
(review item 38, chapter 11).

A title is not a value object (L10). It has no identity and it has a
rule, but the entry point checks the rule once and everything below
trusts it (L12). That is lighter than a type with a constructor, and
just as safe.

**Target.**
- The package becomes `business/entity`, so its name says what it
  holds.

**Open.**
- What sits beside entities in `business/entity`: rules, input types
  (`NewTodo`, `TodoPatch`, `TodoFilter`), read shapes (`TodoCounts`)
  and `Result`. Their names are open too.
- Whether `Result`, which is not about todos, should get a home of its
  own if more such helpers appear. Failures, which are not about todos
  either, got one in stage 06: `packages/fail` (chapter 13).

## 8. Data

Data is the concrete world, one package per real thing: a database, a
vendor such as Stripe. A data package takes business objects, maps
them to its own internal representation (a row, a vendor payload) and
back. The same business object can live in several data packages.

Data imports business and fail, nothing else of ours. It names the
root of every failure it meets (chapter 13).

Data makes no ids and decides no rules. It maps, and it reports facts
(D13, chapter 6).

**Pending (L26).** A data spec, to be tried after the api spec is
built. It would state, in markdown, what each store call must
guarantee and not how: its name and the use cases that use it, its
input and result in business types, what it keeps atomic, the order
it returns, and its failures. Nothing would be generated from it. SQL
stays hand-written, because the engine-specific choices in it are made
for performance (DB1, DB6). Each store function's doc comment would
cite its section, and a conformance suite would hold one test per
guarantee, run against D1 now and Postgres later.

### The D1 package

`packages/data/d1` is the api's database. It holds the migrations
(`migrations/0001_todos.sql`) beside the code that depends on them,
and `apps/api/wrangler.jsonc` points `migrations_dir` at them (DB8).

The table:
- **Order:** SQL has no insertion order, so the table has a `seq`
  column, the rowid, and `listTodos` orders by it. `seq` never leaves
  the package (DB6).
- **Mapping:** SQLite has no boolean, so `completed` is stored as 0 or
  1, with a `CHECK`. `Row`, `toRow` and `toTodo` map between the row
  and the business `Todo` (DB7).
- **`STRICT`**, so SQLite refuses a value of the wrong type rather
  than storing it.

### One flat `DbStore`

`store.ts` builds the store the app uses: `createDbStore(db)`, one
flat object that spreads in each table's methods (`...todoStore(db)`).
`DbStore` is its type. It names no operation's port: each operation
declares the methods it needs, and construct checks that `DbStore`
fits them (chapter 4).

Flat means one namespace. If two tables gave a method the same name,
the later one would silently replace the earlier. Two things guard
against it: method names include their table (`listTodos`, not
`list`), and a unit test lists every method the store has.

Building the store only keeps `db`. It prepares no statement and does
no I/O, so it is cheap to build once per isolate (chapter 1).

### Three layers per method

Each table's file (`todos.ts`) builds each method from three layers,
top to bottom:

| Layer | Holds | Speaks |
|---|---|---|
| **Stmt** | the SQL and its binds, side by side | placeholders and values |
| **Raw** | runs one statement and names its failure | rows and change counts |
| **Outer** | the `DbStore` method | business objects and facts |

- **Stmt** keeps each `?1` next to the value bound to it, so the bind
  order can be read at a glance. SQL is written by hand. Every value is
  bound and never put in the SQL text. Building a statement does no
  I/O.
- **Raw** runs the statement through a driver helper and gives the
  failure its context: "insert todo unless full", "select todos".
- **Outer** maps the business object to a row and back, and turns a
  raw answer into a fact: one changed row means "inserted". It is
  data's anti-corruption layer (L9): rows and driver answers stop
  here, and only business objects and facts go up.

The driver helpers in `driver.ts` are the only code that runs a D1
statement. `queryAll` returns rows and `execute` returns the change
count. D1 reports every error by throwing, so each helper catches the
error and returns it classified. Each takes a function that builds
the statement, not the statement itself. D1 can throw while binding a
value it cannot store, and building inside the `try` means that error
is classified too.

`queryFirst` and `batch` are named in the design but not written,
since no method needs them yet.

### Classifying D1's errors

D1 throws a plain `Error` with no error code, so `classify.ts` reads
the message:
- the texts Cloudflare documents as passing (a lost connection, a
  reset, an overload) become `unavailable`;
- account limits (database size, the free plan's daily rows) become
  `unavailable` too;
- anything else becomes `server`, including our own bugs: bad SQL, a
  missing table, a broken constraint.

The D1 error stays the failure's cause, so the log keeps all of it.

Matching on message text is fragile. If Cloudflare rewords a message,
it falls through to `server`, the safe side: a passing outage is
logged as a bug, and nothing breaks.

### Rows are trusted, not checked

`queryAll<Row>()` casts D1's rows to `Row`. Nothing checks at run time
that they match. Our own database is not a trust boundary, and a row
that does not match is a bug, not an input. What would catch such a
bug is a test of the real SQL against the migrations, which belongs
to the integration-testing session.

A runtime check (valibot in the driver helper, throwing on a mismatch)
is an open question. Its cost grows with rows × columns: an estimated
few microseconds per row, small next to a D1 round trip but counted
as CPU time, and the free plan allows 10 ms of CPU per request. If the
question is taken up, measure it on a realistic list first.

### What the tests prove

The d1 unit tests run on a fake `D1Database` that records each
statement's SQL and binds. They prove what we send to D1 and how we
read its answer: the bind order, "one changed row means inserted",
the mapping, and that failures are classified with their context.
They do not prove that the SQL is right. Only a real D1 can, which
today means the api's integration and e2e tests.

**Target.** Each data package is a workspace package of its own under
`packages/data/` (A1). `data/d1` is the first. `data/memory` was the
first until stage 06 deleted it. It was kept for tests at first (DB4),
then the owner chose to delete it. Its places in the tests are taken
by a fake `D1Database` in the d1 unit tests and an array-backed fake
`DbStore` in `construct.test.ts`.

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

L5's second half, who owns the port once a database replaces the
memory store, is answered: the operations still do. The data package
exports `DbStore` and never names a port (chapter 4).

**Open.**
- **The integration-testing session**, an open design session: whether
  `data/d1` tests its own SQL against a local D1, and how to prove
  that `Row` matches the migrated table.
- Runtime checking of rows, and its CPU cost (above).
- Building the `DbStore` per request: D1 sessions for read
  replication, or a driver over a socket (review item 30).
- SQL dialect differences, if a second database arrives (stage 08).
- **Supabase (Postgres) is the target store (L7).** To settle:
  - the access route: PostgREST (`supabase-js`) has no transaction
    across calls, while Hyperdrive with `postgres.js` or `pg` gives
    interactive transactions, at the cost of round trips while a lock
    is held;
  - how each intent port keeps its atomic promise there (chapter 6);
  - whether D1 stays for the lab.
- Behaviour the store carries out today: the patch's `COALESCE`,
  `setAllCompleted`, `deleteCompleted` and the counts'
  `COUNT(*) FILTER`. It may stay there (L13). To be walked with the
  data layer: which of these moved for performance, and so need a
  comment.
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
  handlers   → processes  → operations
  handlers   → business
  handlers   → contract     (the provider's own contract)
  probes     → contract
  data       → business
  data       → contract     (the contract of the system it reaches)
  handlers, probes, processes, operations, data → fail
  ```

  Business imports nothing of ours, contract included. A contract
  imports nothing of ours either, and neither does fail (chapter 13).
  A process imports operations' types only, since construct hands it
  built operations (L18). Handlers and probes both import `app/errors/`
  (L20). Probes import neither operations nor processes.
  Within `business`, `operations` and `processes`, each area is a
  sibling folder, so the hierarchy rules keep areas apart; the
  layers below reach any area (L22).
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

### Following an entry chain (L24)

Any entry chain can be followed from its entry point to the driver
without a search. Two things keep it so, and they are rules, not side
effects:
- **Construct is the map.** Each route in `constructRoutes` names its
  method and path, its handler and the unit the handler runs.
- **A path names its layer and area.** `handlers/todos/patch-todo.ts`
  → `operations/src/todos/update-todo.ts` → `data/d1/src/todos.ts`.
  An operation's port is declared in the operation's file.

An entry chain is written in one line of exported symbols:

```
PATCH /todos/:id → patchTodo → updateTodo ⇢ UpdateStore.updateTodo → d1.updateTodo → queryAll
```

- `→` is a direct call.
- `⇢` crosses a port: the caller sees the interface, and construct
  picks the implementation.

Each name is a symbol, so the line can be grepped as written. One
Mermaid diagram may draw the layers once; entry chains themselves are
written in text.

**The index.** `apps/api/entry-chains.md` lists every entry point, one
block each, starting with its entry chain in the shorthand, then one row per
link: the file and the symbols it exports, with no line numbers.

```
## PATCH /todos/:id
PATCH /todos/:id → patchTodo → updateTodo ⇢ UpdateStore.updateTodo → d1.updateTodo → queryAll

use case  prd/todo/use-cases/todos/change-a-todo.md
route     apps/api/src/construct.ts                       constructRoutes
handler   apps/api/src/app/handlers/todos/patch-todo.ts   patchTodo
rules     packages/valid/src/todos/title.ts               checkTitle
op        packages/operations/src/todos/update-todo.ts    updateTodo, UpdateStore
data      packages/data/d1/src/todos.ts                   updateTodo
driver    packages/data/d1/src/driver.ts                  queryAll
```

- Links every entry chain shares (`present.ts`, `mapFailure`, the body
  limit in `http.ts`) are listed once, at the top.
- A probe's block ends at the probe; it has no unit.
- The `use case` row is the path the unit cites (L25).
- The index is generated, never written by hand. Its first line says
  so, names the script and says not to edit it. Its name is lowercase
  to mark it as an output.
- It is checked by regenerating it and diffing the result.

**Open.**
- The generator. It belongs with the monorepo's scripts in `tooling/`,
  which waits for its own discussion.
- Pointing to the index from `AGENTS.md`, which may need a recorded
  exception (rl-0009).

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
  (deps: { dbStore: AddStore; newId: () => string }): AddTodo =>
  async (input) => { … };
```

The type of what it returns is named after it (`AddTodo`). The code
has no classes and no `this`, so nothing loses its binding when Hono
receives a handler. A unit with nothing to inject is a plain value
(`getHealth`).

One class exists, and it is data, not behaviour: `Fail` extends
`Error`, so a failure carries a stack and a `cause` chain that
`console.error` prints in full (chapter 13).

Code is written to be read (review items 36, 38):
- name intermediate values, and write steps in the order they happen;
- every `if` has braces;
- no terse one-liners and no nested ternaries;
- name a function for the problem it solves.

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

`contract` holds (D1, D4):
- **messages**: the request and reply shapes (`AddTodoBody`,
  `TodoReply`, `TodoListReply`, `HealthReply`) as valibot schemas,
  generated into `messages.ts`;
- **wire limits**: `BODY_LIMIT_BYTES`, written by hand;
- **error vocabulary**: the envelope's kinds, generated into
  `kinds.ts`, and the `Envelope` shape, written by hand;
- **runtime decoding**: the same schemas parse the request in the api
  and the reply in the client;
- **endpoints** (A4), generated into `endpoints.ts`.

An endpoint is plain data, keyed by method and path as the spec
writes them (`"PATCH /todos/{id}"`):
- method and path;
- the input schema;
- the reply schema;
- the error kinds this endpoint can return, narrowed from the full
  vocabulary.

Narrowing the kinds lets a consumer switch on them exhaustively:
`POST /todos` can fail with `validation` or `limit`, and TypeScript
says so (`EndpointErrors<"POST /todos">`). The endpoints exist, but
both sides still hard-code the path `"/todos"`, and nothing yet
checks that a switch on an error kind is exhaustive (review tour §8).

A contract holds no client. A client is the consumer's concrete call,
so it lives in the consumer's data (chapter 8). The consumer derives
the types it sends from the schemas (valibot's `InferInput`).

### The api spec defines the api (L26)

An api is defined in markdown before it is coded, in one spec per api:
`prd/<app>/api.md`, beside the use cases. One spec per api matches one
contract per api. If an api grows too big for one file, splitting it
is a recorded change.

The spec defines every endpoint the api serves. A probe is part of the
api: where its entry chain ends does not change what a caller sees.
Every endpoint has the same form:
- method and path;
- its input: path parameters, query and body;
- its reply;
- the error kinds it can return;
- what it serves: the use case path when it runs a unit, or the
  requirement when it is a probe (a probe runs no unit, so it has no
  use case: L20, L25).

The spec also holds the shapes several endpoints share (`TodoReply`,
`TodoListReply`) and the envelope's kinds.

The use case and the endpoint do not repeat each other. The use case
states the input, result, rules and failures in business terms. The
endpoint states how they look on the wire.

**Rules as data.** The spec's vocabulary states rules as data only,
for example "at least 1 field". It cannot hold a function. This chapter
already puts shape in the contract and rules in business, so a rule
the vocabulary cannot state belongs in business. `PatchTodoBody`'s
"title, completed or both" was written as a `v.check` function. It is
shape (which keys the body has), so it becomes valibot's
`minEntries(1)`.

**Generated from it:**
- the contract, `packages/contract/api/src`: the valibot schemas,
  their messages, the kinds and the endpoints (A4). Done, by
  `tooling/api-spec/generate.ts`;
- the OpenAPI document, `apps/api/openapi.json` (target).

Both are committed and name the script that wrote them: the
contract's files in their first line, the document in
`x-generated`. `generate.ts --check` writes nothing and fails when a
committed file differs from what the spec generates.
The route table and the BFF's client take method and path from the
contract's endpoints, so a path is written once, in the spec.

Generation stops at the contract. Entry points, operations, business
and data are written by hand.

### The spec's vocabulary (draft)

A draft, tried first on `prd/todo/api.md`. Each line below is one
thing a parser reads.

The spec has four sections, in this order:
- **Every endpoint**: what holds for every request, in prose, and
  one `Errors:` line naming the kinds every endpoint can return. An
  endpoint lists only the kinds it adds. A kind in prose is not read:
  `not_found` for a route the spec does not list is not one every
  endpoint returns.
- **Errors**: the envelope's kinds, and whether each carries `field`.
  Statuses are not in the spec (see OpenAPI below).
- **Shapes**: the shapes several endpoints share, one `###` heading
  each, named in code font.
- **Endpoints**: one `###` heading each, the method and path in code
  font, with path parameters in braces (`/todos/{id}`).

An endpoint has these parts, in this order, each left out when empty:
- `Serves:` a use case path, or for a probe the PRD part it serves;
- `Path:` a list of fields, one per path parameter;
- `Query:` a shape;
- `Body:` a shape;
- `Reply:` the success status, then a shape;
- `Errors:` the kinds it adds, or `none`.

The spec has no tables: they are slow to write and break when a
column is edited. Everything is a heading, a labelled line or a list
item, one per line.

A shape is a named shared shape, or a name in code font with a list of
fields under it. A shared shape can instead be a list: one line,
`` list of `TodoReply` ``. A field is one list item:

```
- `name`: type, optional "message"
```

- A field is required unless it says `optional`.
- The message, in quotes, is optional: the text a caller sees when the
  field has the wrong type.

A shape line can add one object rule after a comma: `at least N
fields`, with its message in quotes. A path parameter is a field
without `optional` or a message.

Types:
- `text`, `boolean`;
- `integer, min N`;
- `literal` followed by a value in code font: `` literal `true` ``
  for the boolean, `` literal `"true"` `` for the text;
- `one of` followed by values in code font, separated by spaces;
- `list of` followed by a shape's name;
- a shape's name in code font.

Every object is closed; there is no word for an open one. A rule the
vocabulary cannot state belongs in business, not in the spec.

### OpenAPI documents the contract (L23, L26)

The api's contract is documented as OpenAPI. Only backend apis get
one; the BFF does not. It is generated from the api spec, beside the
contract (L26). No code is generated from the document itself.

OpenAPI calls a route an *operation*. We do not: a route is an entry
point at a method and path, as Hono records it, and *operation* is
only ever a business use case (L14). In the document, `operationId`
is the entry point's name (`postTodos`) and `x-unit` names the unit it
runs (`addTodo`). A probe's route has no `x-unit`. Neither is in the
spec. They come from construct, read by the one extractor in
`tooling/` that also feeds `apps/api/entry-chains.md` (L24).

Each failure kind has the status `app/handlers/present.ts` gives it:
`validation` 422, `not_found` 404, `limit` 409, `too_large` 413 and
`internal` 500.

**Target.** Checks keep the spec, the generated files and the code in
step:
- regenerate and diff: a generated file that differs from its
  regeneration fails;
- an api unit test compares the routes Hono registers with the
  spec's endpoints.

### Which rules go in a contract

- **Shape** goes in the contract: which fields a message has and their
  types. `AddTodoBody` is an object with a string `title`, and no
  other keys.
- **Rules** stay in business, whether or not they need state. A title
  is 1–256 characters after trimming (`TITLE_MAX`); the list holds at
  most 500 todos (`TODO_LIMIT`). The contract only names the failure
  (`validation`, `limit`).

Slice 2 put the title rule in the contract, as a shape rule anyone
could check with the message alone. Stage 06 moved it to business
(review item 38), and the contract kept only the wire shape. Both the
api and the BFF already import business, so neither lost access to
the rule.

Validation has one authority. Business defines the rule, and the api
enforces it. A consumer may apply the same rule early, for a better
form, but the api never trusts that it did.

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
a backend operation, the api's `addTodo` included: adding a todo has
one authority, and it is the api. Its own operations are UI concerns,
such as aggregation and filtering, and never touch a database (L21).
They wait for the BFF story.

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

## 13. Failures

Stage 06 gave the api one failure type for every layer. Before it,
each layer had its own: the operation returned `{ kind: "full" }`, the
memory store could not fail, and the handler translated by name. A
database can fail in every call, so failures now cross every layer,
and they need one shape to do it.

### One type, a fixed set of kinds

`packages/fail` holds every failure our code can name. It imports
nothing, so every layer can import it (chapter 9). It is a package of
its own, not part of business, because failures are not about todos,
and not part of the contract, because its kinds are not the wire's
(below).

| Kind | Meaning | Made by |
|---|---|---|
| `invalid` | input breaks a rule; `field` names it | `invalid(field, message)` |
| `not_found` | the thing asked for does not exist | `notFound` |
| `limit` | a business limit refused the request | `limitReached` |
| `too_large` | the request is bigger than we accept | `tooLarge` |
| `unavailable` | something we depend on cannot answer now | `unavailable` |
| `server` | our own fault, or an error nobody recognised | `serverFault` |

`Fail` is a class that extends `Error`, so each failure has a stack
and a standard `cause`. `AnyFail` is the union of `Fail<K>` for every
kind, so checking `kind` narrows it.

### Named once, at the root, then wrapped

The package that first meets an error decides its kind. Every package
above only adds context, as Go's `%w` does:

```
d1:        classify     → unavailable("select todos: D1_ERROR: Network connection lost.")
operation: wrap(…, "list todos")
           → unavailable("list todos: select todos: D1_ERROR: Network connection lost.")
handler:   mapFailure   → 500, and the whole chain in the log
```

`wrap` keeps the kind and the field, and points `cause` at what it
wraps. A failure's kind never changes on the way up. So the handler
can trust it, and a log shows the chain back to the root.

Every layer returns `Result<T, AnyFail>`, or a narrower failure when
it knows more (`validateBody` returns `Fail<"invalid">`).

### Only bugs throw

On the request path, failures are values (D4). A throw means a bug,
and `onError` turns it into a `server` failure and a 500.

Stated exactly: our own TypeScript throws only on a bug. Anything D1
reports comes back as a `Result`, even when the cause is our bug (bad
SQL, a missing table, a value D1 cannot bind). D1 reports every error
by throwing, so the driver helpers catch everything and classify it
(chapter 8). The reply and the log come out the same either way.

### Resolved once, at the edge

`handlers/present.ts` turns a failure into a reply, with two tables
the compiler checks for every kind (`satisfies Record<…>`):
- `contractKind` maps each failure kind to a wire kind: `invalid` →
  `validation`, and `unavailable` and `server` → `internal`.
- `status` maps each wire kind to a status code.

A new failure kind does not compile until it has a wire kind, a status
and a side.

The side decides what the reply says:
- `userFailure` takes the four user kinds and replies 4xx. The message
  is the root failure's.
- `serverFailure` takes `unavailable` and `server` and replies 500
  with `internal error`. The whole failure goes to the log, never to
  the caller (PRD, Envelope).

A handler picks one by what it knows. When the failure is known (a
validation step can only fail as `invalid`) it calls `userFailure`
itself. When the failure is dynamic (an operation can fail either
way) it calls `mapFailure`, whose `switch` names every kind and ends
in a `never` check.

### Who reads a message

A failure's message has two readers, decided by its kind:
- for a **user** kind, the root's message is the reply, so it is
  written for the user: "the list is full", "title is empty";
- for a **server** kind, it is for logs and developers only: "select
  todos: D1_ERROR: …".

So a user failure's message must never come from a server failure.
`rootOf`, which finds the message a reply shows, follows the `cause`
chain only while the kind stays the same. A `not_found` failure caused
by an `unavailable` one shows its own message, not D1's. Before the
review, `rootOf` walked the whole chain, and such a failure would have
sent D1's text to the caller. Nothing created one yet, but the types
allowed it.

**Open.**
- `unavailable` is `internal` and 500 today, because the PRD's
  envelope has no kind for it. A `503` with `Retry-After` would tell
  the caller that trying again may work. The health database check
  would likely add it (review item 41).
- Account limits count as `unavailable`, but a daily limit clears only
  tomorrow. Nothing retries today. Once something does, they need a
  kind of their own, or they will be retried over and over.
- The BFF's failures, in refactor B: the bff-api has the same need,
  and its data client already adds `unavailable` (chapter 8).
