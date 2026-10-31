# Slice 1 (Health): decisions settled by Claude

Working agreement for this slice (owner, 2026-10-30): Claude settles
the open slice 1 composition questions from handoff 00 (C1–C5) and
builds on them. The owner reviews the result, then the two discuss
each decision in turn. A decision changed at that review is recorded
here, with what it changed in the code.

Each entry: the decision, the reason, and what it constrains in the
code, so the review can check one against the other.

## C1 Import graph

*Replaced at the review by R1–R8 below.*

**Decision.** api → contract, web → contract, contract → nothing in the
workspace (valibot only). web never imports api. Inside api the
direction is `routes → handlers → operations → data port`, and only
`src/index.ts` imports an adapter.

**Reason.** It is the only graph where contract is the single shared
truth (P17: limits defined once), and each arrow is checkable by an
import scan, which is what the profile needs.

**Constrains.** No `@todo/api` in `web/package.json`. No relative
import that climbs out of a mount. In slice 1 the data port does not
exist yet (C2), so the api chain stops at operations.

## C2 Health and the store

**Decision.** Health stays pure: `GET /health` returns `200 { ok: true }`
without touching the store port.

**Reason.** The store arrives in slice 2. Pinging it would add a kind
`unavailable` (503) that the PRD does not have, and an in-memory store
inside the same Worker cannot be down independently of the Worker,
so the ping would prove nothing.

**Constrains.** The envelope kinds stay the five in the PRD. Revisit if
the store ever becomes an external binding (KV, D1, DO).

## C3 Handler placement

*Replaced at the review by R5–R8 below.*

**Decision.** `routes/` binds paths and validators. `handlers/` is the
HTTP face: one named export per file, which turns a validated input
into an envelope response. `operations/` is the pure core: no Hono and
no `Context`, and it returns `Result`.

**Reason.** Operations can then be unit-tested in node with no Workers
pool (P9), and "one route, one handler file" can be checked by machine.

**Constrains.** In slice 1 health has a handler but no operation (there
is nothing to compute). The first operation arrives in slice 2. The
error handler and not-found handler are handlers too, and each is
exported so the unit tier can call it directly (handoff 00 correction).

## C4 `Result<T, E>`

**Decision.** Hand-rolled and private to the api, in
`api/src/result.ts`. It is not in contract and is not a dependency.

**Reason.** Only the api uses it. The web sees envelopes, not
`Result`, so putting it in contract would widen the shared surface for
no consumer. Hand-rolled keeps it a dozen lines with no supply-chain
cost.

**Constrains.** Contract exports schemas, types and limits only. The
handler is the single place `Result` becomes an envelope.

## C5 Web test tiers

**Decision.** Web has unit and e2e tests but no integration tier. The
slice covers all three tiers across the packages: api has unit and
integration, web has unit and e2e.

**Reason.** The web's only integration point is the `API` binding.
Unit tests cover it with a fake binding, including the failure case,
and e2e covers it with the real one. A web integration tier would
repeat one or the other.

**Constrains.** Web has no `vitest.integration.config.ts` and no
`test:integration` script; the root's `--if-present` skips it. The
"API down" case is a web unit test (PRD slice 1 note).

## Details settled at the same time

- **Validation:** valibot schemas in contract, `@hono/valibot-validator`
  in api routes (owner choice, P25).
- **Unknown route:** tested at integration, not as a unit test of the
  app (handoff 00 correction).
- **Body limit:** Hono `bodyLimit` at 8 KiB is registered app-wide in
  slice 1, before any route that has a body, so `too_large` is tested
  from the start (deviation 8).
- **Telemetry (P23):** `dev` and e2e will trip wrangler telemetry. Slice
  1 records whether the run fails or only logs, and does not set the
  env var silently.

## Review, session 03 (owner-led, 2026-10-30)

The owner opened the review with the api's architecture as a whole.
It replaces C1 and C3. C2, C4 and C5 were not reached. No code changed
in this session; the refactor is the next session's first step, and
each entry below says what it will change.

### R1 Startup has two halves (replaces part of C1)

**Decision.** Startup covers what happens once per isolate, before the
first request, and what happens on each request until an entry point
takes over. The boundary between the two is explicit in the code.

**Will change.** `createApp()` builds middleware and routes in one
Hono chain at module load, so the two halves are not distinguishable.

### R2 `index.ts` tells the story

**Decision.** `src/index.ts` is where the app's story is read, top to
bottom: load config (and handle its failure), construct, wire. It
delegates every step and does nothing itself. Hono is not the
vocabulary of the story: our own deep module exposes the interface
`index.ts` uses, and drives Hono's configuration behind it.

**Will change.** `index.ts` is one line; the story is in `app.ts`,
written in Hono's terms (`use`, `route`, `notFound`, `onError`).

### R3 Config

**Decision.** Config is the first thing processed. It ensures every
environment value exists and has the right shape, puts it into our
object shape, and freezes it (it changes only with a deploy). Only
`index.ts` and construct import config.

**Will change.** There is no config; slice 1 reads no environment
values. `BODY_LIMIT_BYTES` is a wire fact in contract, not config.

### R4 Construct

**Decision.** Every app has a construct package that knows how to
build all objects and their dependencies, including entry points and
routes, from a fully loaded config. It copies config values to what
needs them; nothing else sees config. Only `index.ts` imports
construct, which keeps the graph acyclic.

**Will change.** Routes and handlers are module-level values built on
import; nothing is constructed or injected.

### R5 Entry points (replaces C3)

**Decision.** Handlers are entry points: they pick up where the
per-request startup leaves off and meet the expectation of the API
route aimed at them. The entry point is a template with four
responsibilities:

1. Translate unsafe input into validated, well-defined shapes.
2. Execute the operations it exists for.
3. Handle errors from input, operations and presentation.
4. Convert the operation's result into the expected presentation.

With validation, operations and presentation delegated, the template
has no reason to change. Logging and telemetry are shared between
middleware and entry points. Startup and construct create entry points
and inject their dependencies.

**Will change.** Handlers are not built by anything, and no template
is stated. `respond.ts` is roughly the presentation step.

### R6 Business, data, operations

**Decision.**
- **Business:** only business types, behaviour (interfaces) and pure
  logic; no db, io, network or api calls. Anything may import it; it
  imports none of our other packages.
- **Data:** the concrete world, one package per real thing (a db, a
  vendor such as Stripe). A data package takes business objects and
  maps them to its own internal representation (a row) and back, so
  the same business object can live in several data packages.
- **Operations:** use business and data to do the work; entry points
  use operations. Operations import business directly. Data is never
  imported: an operation declares the interface it needs, and
  construct injects the data package.

**Will change.** None of the three exists yet (no operation in slice
1). This settles L5: the store's interface is owned by the operation
that uses it, not by data.

### R7 Two zones

**Decision.** The import rules differ in two zones.
- **Composition zone** (`index.ts`, config, construct): privileges by
  explicit allow-list. `index.ts` imports config, construct and the
  HTTP module; construct imports config and anything it builds; config
  imports nothing of ours; nothing imports `index.ts`.
- **Hierarchy zone** (entry points and the rest): the hierarchy rules
  in R8.

Layout: the composition zone sits at the top of `api/src`, and the
hierarchy zone lives under one directory beside it, so position alone
decides which rules apply (Go's `cmd/` precedent).

**Will change.** `api/src` is laid out by technical role (`routes/`,
`handlers/`, `respond.ts`) with no zones.

### R8 Hierarchy and layout

**Decision.**
- **Across layers:** allowed edges between the top-level groups,
  `entries → operations → business` and `data → business`
  (validation and presentation not yet placed).
- **Within a layer:** packages are hierarchical; general at the root,
  specific at the leaves. A child imports its ancestors; a parent
  never imports its children. Parents are where children share logic
  and types.
- **Layout is the hierarchy**, as in Go: a file's directory says what
  it may import.
- **Depth:** counted from the layer directory as level 1. 4 is the
  norm, 5 only when really needed, never 6.

**Will change.** Today `app.ts` imports `handlers/*` and `routes/*`
(general importing specific) and `routes/health` imports
`handlers/health` (a cousin import). Checkable exactly by an import
scan (F14, P27): ancestor rule within a layer, edge list across
layers, allow-list in the composition zone, depth by path.

### R9 Object style

**Decision.** Rust and Go, not Java: data types and functions,
composition over inheritance, small interfaces declared by the code
that uses them, constructor functions, errors as values.

**Will change.** Nothing yet; it governs the refactor.

### Open, raised in the review

1. "Package": workspace packages or directories inside `api/src`?
2. The unit: is a directory a package with one public file, and how
   is privacy shown without Go's `internal/`?
3. Contract wire shapes vs business types, and whether mapping between
   them is the entry point's validation and presentation.
4. Where our Hono module sits: composition zone (driven by `index.ts`)
   while entry points may need its types.
5. Where validation and presentation sit, so entry points reach them.
6. Siblings within a layer: may they import each other without a
   cycle, or only through a shared parent?
7. Across layers: may an import reach any depth, or should some
   packages stay private to their layer?
8. Where a depth-5 reason is recorded.
9. Classes as Go structs (no `extends`) or constructor functions
   returning plain objects; `this` binding when a method is handed
   to Hono.
10. Config failure at module load: the Worker fails to start and no
    envelope is returned; deploy rejects it. The story should say so.
11. Config validates an empty shape in slice 1 unless something
    belongs in it.
12. C2, C4 (`Result`'s place, now a layering question) and C5 not
    reviewed.

## Refactor, session 03 (2026-10-31)

The owner asked for the code to follow the api story, using only the
parts health has. There is no config, no operation, no business and no
input to validate, so none of those is created.

### S1 Layout: handlers in the hierarchy zone (applies R7, R8)

**Decision.**
- The hierarchy zone is `api/src/app/`. Its first layer is
  `app/handlers/` (level 1).
- A directory is a package. The files directly in it are the package,
  and its children are its subdirectories. This settles open
  questions 1 and 2 for now, without privacy.
- Presentation (`respond.ts`, renamed `present.ts`) sits in the parent,
  `handlers/`, because every handler shares it. This places
  presentation for open question 5: it lives inside the handlers
  layer, not as a layer of its own.
- Each handler is a child package that imports only its ancestor's
  `present.ts`:
  - `health/` holds `getHealth`.
  - `errors/` holds `notFound`, `tooLarge` and `onError`. These answer
    a request that no real handler answers. They share the failure
    envelope and have no dependencies, so they change together. Each is
    one line, so they share one file. A handler that grows real logic
    becomes a child of `errors/`.
- No handler has the four-duty template yet. Health only presents, and
  the errors handlers present an error kind.

**Changed in the code.**
- `src/handlers/health.ts` moved to `src/app/handlers/health/health.ts`.
- `src/handlers/{not-found,too-large,error}.ts` were merged into
  `src/app/handlers/errors/errors.ts`.
- `src/respond.ts` moved to `src/app/handlers/present.ts`.
- `src/routes/health.ts` was removed, which ends the cousin import
  `routes/health → handlers/health`. `app.ts` binds `GET /health` itself
  until construct takes the route table over (S3).
- The unit test moved to `test/unit/app/handlers/errors/errors.test.ts`
  to mirror the source.
- `app.ts` still imports the handlers (general importing specific). S3
  ends that.

### S2 The entry-point layer is named `handlers` (changes R8)

**Decision.** The layer R8 called `entries` is `handlers`. "Entry
point" stays the name of the role (R5, story chapter 5). The directory
uses the word people already know from Hono's `Handler`,
`NotFoundHandler` and `ErrorHandler` and from Go's `http.Handler`. It
also avoids `entries`, which reads like data once todos arrive.
Middleware is not a handler here: it belongs to the per-request half
of startup, and gets its own name (`middleware`) when it has a home.

**Changed in the code.** The layer directory is `src/app/handlers/`,
not `src/app/entries/` (S1). R8's edge list reads
`handlers → operations → business` and `data → business`.
