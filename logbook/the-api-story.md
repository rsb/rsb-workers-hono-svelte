# The api story

How the todo api is put together, told in the order a request meets
it. Each chapter covers one part. Chapters start thin and fill in as
features need them. Each ends with what is still open.

The decisions behind this story are:
- R1–R9, in
  [drafts/2026-10-30-02-slice-1-decisions.md](drafts/2026-10-30-02-slice-1-decisions.md);
- S1–S2, in the same draft;
- D1–D20, in
  [drafts/2026-10-31-04-slice-2-decisions.md](drafts/2026-10-31-04-slice-2-decisions.md).

After slice 2 (Add and list), the code follows the story throughout,
except for config, which has nothing to hold yet (chapter 3).

Paths are under `apps/todo/api/src/`.

```
index.ts            the story
construct.ts        builds everything, once per isolate
http.ts             our HTTP module: drives Hono
app/
├─ handlers/        entry points
├─ operations/      the work
├─ business/        types, rules, Result
└─ data/            one package per real thing
```

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

Only `index.ts` imports construct, which keeps the import graph
acyclic.

In the code (`construct.ts`), construct:
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

**Open.**
- What happens to the ports, and to the cap's exactness, when a store
  needs `await`.

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

**Open.**
- Who owns the port if a database package replaces the memory store
  (L5's second half).

## 9. The shape of the code

### Two zones

The import rules differ in two zones:

- **Composition zone** (`index.ts`, config, construct, `http.ts`).
  Privileges come from an explicit allow-list:
  - `index.ts` imports config, construct and the HTTP module.
  - construct imports config and anything it builds, plus the HTTP
    module's types (D3).
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

**Open.**
- How privacy is shown without Go's `internal/`.

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
