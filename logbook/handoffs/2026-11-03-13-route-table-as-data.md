# Handoff 13: the route table as self-describing data, 2026-11-03

Since handoff 12:
- **Stage 11 is merged** (PR #33, `main` at `1f0e4d2`).
- **The owner picked item A** of handoff 12's backlog, the route table
  as self-describing data, as stage 13. Handoff 12's brief for A is
  the starting point; this file corrects it where the code disagrees
  and lists the questions to settle before code.

The next session starts from this file, handoffs 12 and 11, and the
story. Handoff 11's Rules that must be kept and its Environment apply
unchanged. The ones this stage touches most:
- Never edit a generated file. `apps/api/openapi.json` changes only by
  `pnpm gen:api`, and `pnpm check:api` stays green.
- Commits: conventional, no attribution, staged by explicit path, on a
  branch, only when asked. Claude never pushes. No `pnpm install`.
- Discuss first: no code before the owner answers the questions below
  or says "you decide".

## What exists (read first)

- `apps/api/src/http.ts`: `Route = { method, path, handler }`. Nothing
  else is carried.
- `apps/api/src/construct.ts`, `constructRoutes`: eight routes, written
  with Hono's paths (`/todos/:id`). **Handoff 12 says routes already
  take their path from `endpoints`. They do not.** Both the paths and
  the methods are written out by hand, and the unit appears only as
  the argument (`postTodos(operations.addTodo)`).
- `packages/contract/api/src/endpoints.ts` (generated): `endpoints` is
  keyed by the spec's form, `"PATCH /todos/{id}"`, with braces.
- `tooling/api-spec/emit-openapi.ts`: its header says "Not here yet:
  `operationId` and `x-unit`, which come from the construct." Story
  chapter 11 says one extractor in `tooling/` reads them from
  construct and also feeds `apps/api/entry-chains.md`.
- `apps/api/entry-chains.md` does not exist. Story chapter 9
  ("Following an entry chain") specifies it, and lists its generator
  and an `AGENTS.md` pointer to it as open.
- **The L24 example is out of date.** It shows
  `d1.updateTodo → queryAll`. The data methods now go through private
  `*Raw` functions in `packages/data/d1/src/todos.ts` before reaching
  the driver (`queryAll`, `execute`, `writeThenQueryAll`). Private
  symbols cannot be grepped from the index the way L24 wants.
- **A probe in this session:** a plain `node` script in `$TMPDIR`
  imported `apps/api/src/construct.ts`, built the routes with a
  `Proxy` store, and printed all eight `METHOD /path` keys. Node 26
  strips the types, and the workspace imports resolve through
  `apps/api/node_modules`. So a `tooling/` script can read the route
  table without a bundler.
- The repo root has no `node_modules`. `typescript` is installed only
  inside the workspaces.
- CI (`.github/workflows/scorecard.yml`, the only workflow) runs
  `pnpm check`, `test:unit`, `test:integration` and `test:e2e`. It
  runs neither `check:api` nor `test:tooling`.

## The plan, in four steps

1. **The route carries data.** `Route` gains `name` (the entry
   point's exported name) and `unit` (the operation it runs, or `null`
   for a probe). Q1 and Q2 set the form.
2. **A routes-vs-spec unit test** in `apps/api/test/unit/` checks that
   the route keys equal the keys of `endpoints`, in both directions.
   It also checks that each `unit` is a key of `Operations`.
3. **One extractor, `tooling/entry-chains/routes.ts`:** it builds the
   route table with a fake infra and returns only the data fields.
   `generate.ts` (the api-spec one) passes those rows to
   `emitOpenApi`, which writes `operationId` and, where there is a
   unit, `x-unit`. Then `pnpm gen:api` regenerates `openapi.json`.
4. **The index.** `tooling/entry-chains/generate.ts` writes
   `apps/api/entry-chains.md`, and `--check` regenerates it and diffs.
   Q4 and Q5 set how far it reaches.

Steps 1 to 3 are size S. Step 4 is the larger half: everything below
the unit (rules, port, data, driver) is not in the route table, and
has to be read from the source.

## Questions to settle before code

- **Q1. Where a route's method and path come from.** Options:
  - (a) Keep them written out in Hono's form, and let the test convert
    `:id` to `{id}`.
  - (b) **Claude's proposal:** key each route by its spec key,
    `"PATCH /todos/{id}"`, typed as `keyof typeof endpoints`. Construct
    derives the method and the Hono path from `endpoints`. A route with
    no spec then fails to compile, so the test only has to check the
    other direction (a spec with no route).
- **Q2. How `name` and `unit` are written.** Options:
  - (a) Plain strings beside the handler, as in handoff 12:
    `{ ..., name: "postTodos", unit: "addTodo", handler: postTodos(operations.addTodo) }`.
    Each name is then written twice per line.
  - (b) **Claude's proposal:** a small typed helper in construct, for
    example `route("POST /todos", { postTodos }, "addTodo")`. The
    object shorthand gives the name, and `unit` is typed as
    `keyof Operations`, so the helper passes `operations[unit]` to the
    factory and the types check that they fit. Probes get their own
    form with no unit. The owner names the helper.
- **Q3. `operationId` and `x-unit` make `openapi.json` depend on
  construct.** Once they are in, `pnpm check:api` fails when a route's
  name or unit changes and nobody ran `gen:api`. Claude's proposal:
  accept that, since the story already says these two values come from
  construct. One ordering detail: construct imports the generated
  contract, so `generate.ts` must write the contract before it loads
  construct. In `--check` mode, construct reads the committed
  contract, which `--check` is comparing in the same run. Confirm, or
  keep the OpenAPI step in a separate command.
- **Q4. How the index reads what lies below the unit.** Options:
  - (a) The TypeScript compiler API. This is exact, but `typescript`
    is not at the root, so the root `package.json` needs a
    devDependency and the owner runs `pnpm install`.
  - (b) **Claude's proposal:** read the source by convention, with no
    parser. The handler and the operation are found from the
    construct's imports. Rules are the handler's `@todo/valid/`
    imports. The port is the operation file's exported `*Store` type,
    and the data rows are the port's methods, looked up in
    `todoStore`. The convention is checked: if a file does not match
    it, the generator fails, and nothing is guessed.
  - (c) Build only what the route table and imports give (`use case`,
    route, handler, rules, op and port) this stage, and leave the
    data and driver rows for later.
- **Q5. The data and driver rows against private `*Raw` functions.**
  L24 wants exported symbols only. Options:
  - list the store method on the `data` row, then the driver functions
    it reaches through `*Raw`, with the `*Raw` step not shown;
  - export the `*Raw` functions;
  - amend L24's example to the current shape.

  This is the owner's call. Claude has no proposal yet, beyond
  updating L24's example whichever option is picked.
- **Q6. Where the checks run.** Proposed scripts: a root
  `gen:entry-chains` and `check:entry-chains`, with `check:api`
  unchanged in name. CI runs neither check today. Adding
  `check:api`, `check:entry-chains` and `test:tooling` to
  `scorecard.yml` (still pinned by SHA, rl-0011) would be this stage's, or a
  separate commit, or not now. If the workflow counts as an owned
  governance file, it needs a recorded exception (rl-0009).
- **Q7. The `AGENTS.md` pointer to the index.** Chapter 9 leaves this
  open because of rl-0009. Claude's proposal: not this stage.

## Story and glossary edits, after the build

- **Chapter 4:** the route carries its name and unit as data.
- **Chapter 9, Following an entry chain:** the index is generated, and
  by what. The example is updated to match the code. The "Open" list
  loses the generator.
- **Chapter 11, OpenAPI:** `operationId` and `x-unit` are now in the
  document, read by the extractor. Remove the "Not here yet" line from
  `emit-openapi.ts`.
- **Ledger:** close L24's index and the routes-vs-spec test. No new L
  number unless the owner gives one, since this builds what L24 and
  L26 already decided.
- The review tour goes to
  `logbook/reports/2026-11-03-13-route-table-review-tour.md`, and any
  profile-notes candidates start at P54.

## Commits, when asked

On a branch made from `main`, for example `feat/route-table-data`:
- one `feat` commit for the code and the regenerated files;
- one `docs(logbook)` commit for the story, the tour, this handoff and
  handoff 12.

## The owner's answers

- **Q1:** go further than proposed. The route table is a
  `Record<EndpointKey, …>`, so both directions fail to compile, and
  step 2's unit test is dropped. `{id}` becomes `:id` in `http.ts` at
  registration. Chapter 11 is corrected: routes were written by hand,
  and after this stage the path is written once, in the spec.
- **Q2:** take the helper, and have it build the handler:
  `route({ postTodos }, { addTodo })` returns `postTodos(addTodo)`;
  `probe({ getHealth })` has no unit. Claude names it.
- **Q3:** accepted.
- **Q4:** (c) as the floor, plus a narrow (b): the port type declared
  in the operation's own file, and the data method carrying the port
  method's name. Fail loudly, no compiler dependency.
- **Q5:** the `*Raw` functions are private, so they are not links. The
  driver helpers are shared links, listed once at the top. L24's
  example ends at the data method, and chapter 9 says why. `*Raw` is
  not exported.
- **Q6:** yes, in a separate commit, with the rl-0009 exception
  recorded in the tour.
- **Q7:** in that same commit, under the same exception.

## Outcome

Steps 1, 3 and 4 were built on `feat/route-table-data`, in three
commits: the code, the governance change and the docs. A full review
of the branch then found names trusted rather than checked, readers
that skipped lines, untested failure paths and docs that claimed more
than the code held; a fourth commit fixes all eight findings. The
review tour, with the findings in its §7, is
[reports/2026-11-03-13-route-table-review-tour.md](../reports/2026-11-03-13-route-table-review-tour.md).
