# The api story

How the todo api is put together, told in the order a request meets
it. Each chapter covers one part. Chapters start thin and fill in as
features need them. Each ends with what is still open.

The decisions behind this story are R1–R9 in
[drafts/2026-10-30-02-slice-1-decisions.md](drafts/2026-10-30-02-slice-1-decisions.md).
The code does not follow it yet. The refactor that brings the code in
line is the next step.

## 1. Startup

Startup has two halves:

- **Once per isolate**, before the first request: load config,
  construct everything, wire it to the HTTP layer.
- **On each request**, until an entry point takes over: the
  middleware that every request passes through.

The boundary between the two halves is explicit in the code. Anything
built once is built in the first half, and nothing in the second half
builds what the first half could have.

**Open.**
- What the per-request half contains beyond the body limit.

## 2. `index.ts`

`src/index.ts` is where the story is read, top to bottom: load config
(and handle its failure), construct, wire. It delegates every step and
does nothing itself.

Hono is not the vocabulary of the story. Our own deep module offers
the interface `index.ts` uses and drives Hono's configuration behind
it.

**Open.**
- Where our Hono module sits, given that entry points may need its
  types.
- Config failure at module load: the Worker fails to start, callers
  get Cloudflare's error rather than our envelope, and deploy rejects
  the script. The story should say how `index.ts` handles this.

## 3. Config

Config is the first thing processed. It:

1. Checks that every environment value exists and has the right shape.
2. Puts the values into our own object shape.
3. Freezes the result. Config changes only with a deploy.

Only `index.ts` and construct import config.

Wire facts such as the body limit belong to contract, not config.

**Open.**
- Slice 1 reads no environment values, so config validates an empty
  shape until something belongs in it.

## 4. Construct

Construct knows how to build every object and its dependencies,
entry points and routes included, from a fully loaded config. It
copies config values into whatever needs them. Nothing else sees
config.

Only `index.ts` imports construct, which keeps the import graph
acyclic.

## 5. Entry points

Entry points (handlers) pick up where the per-request half of
startup leaves off. Each one meets the expectation of the api route
aimed at it, and follows one template with four duties:

1. **Validate:** turn unsafe input into validated, well-defined shapes.
2. **Operate:** run the operations it exists for.
3. **Handle errors:** from input, from operations and from
   presentation.
4. **Present:** convert the operation's result into the expected
   presentation.

Validation, operations and presentation are delegated, so the
template itself has no reason to change.

Entry points share logging and telemetry with middleware. Startup and
construct create entry points and inject their dependencies.

**Open.**
- Where validation and presentation sit, so entry points can reach
  them.
- Contract wire shapes vs business types, and whether mapping between
  them is the validation and presentation steps.

## 6. Operations

Operations do the work. Entry points use them.

Operations import business directly. They never import data.
Instead, an operation declares the interface it needs, and construct
injects the data package that satisfies it. The store's interface is
owned by the operation that uses it, not by data.

**Open.**
- No operation exists yet. Slice 2 (add and list) brings the first.

## 7. Business

Business is business types, behaviour (interfaces) and pure logic
only. It has no db, io, network or api calls.

Anything may import business. Business imports none of our other
packages.

**Open.**
- Whether `Result` belongs here.

## 8. Data

Data is the concrete world, one package per real thing: a database, a
vendor such as Stripe. A data package takes business objects, maps
them to its own internal representation (a row, a vendor payload) and
back. The same business object can live in several data packages.

Data imports business, nothing else of ours.

## 9. The shape of the code

### Two zones

The import rules differ in two zones:

- **Composition zone** (`index.ts`, config, construct). Privileges
  come from an explicit allow-list:
  - `index.ts` imports config, construct and the HTTP module.
  - construct imports config and anything it builds.
  - config imports nothing of ours.
  - nothing imports `index.ts`.
- **Hierarchy zone** (entry points and everything else). The
  hierarchy rules below apply.

The composition zone sits at the top of `api/src`. The hierarchy zone
lives under one directory beside it. Position alone decides which
rules apply, as with Go's `cmd/`.

### Hierarchy

- **Across layers**, the allowed edges are:

  ```
  entries → operations → business
  data → business
  ```

- **Within a layer**, packages are hierarchical: general at the root,
  specific at the leaves. A child imports its ancestors. A parent
  never imports its children. Parents are where children share logic
  and types.
- **Layout is the hierarchy**, as in Go: a file's directory says what
  it may import.
- **Depth** is counted from the layer directory as level 1. Four is
  the norm, five only when really needed, never six.

All of this can be checked exactly by an import scan.

**Open.**
- What "package" means: a workspace package, or a directory inside
  `api/src`?
- Is a directory a package with one public file? How is privacy shown
  without Go's `internal/`?
- May siblings within a layer import each other, or only share
  through a parent?
- May a cross-layer import reach any depth, or should some packages
  stay private to their layer?
- Where validation and presentation sit among the edges.
- Where the reason for a depth-5 package is recorded.

## 10. Object style

Objects follow Rust and Go, not Java:

- data types and functions
- composition over inheritance
- small interfaces declared by the code that uses them
- constructor functions
- errors as values

**Open.**
- Classes as Go-style structs (no `extends`), or constructor functions
  returning plain objects?
- `this` binding when a method is handed to Hono.
