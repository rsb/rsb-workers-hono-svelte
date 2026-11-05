# Handoff 12: the improvements backlog, for the owner to prioritize, 2026-11-03

This handoff starts no stage. It records the improvements proposed in
the planning chat after the annotated report of the api story, so the
owner can order them, and so whichever one is picked can start from a
brief the terminal agent can act on. The next stage takes handoff 13,
whatever it is; the CLI's design and questions stay in handoff 11.

Since handoff 11:
- **Stage 11, `valid` as a deep module, is built and merged** (PR #33,
  `main` at `1f0e4d2`): `toNewTodo`, `toTodoPatch`, `toTodoFilter`
  and `toCompleted` over private `fields/`; the api and the BFF word
  problems from their own message tables; L27 in the story; glossary
  section Validation; profile-notes P47–P53; the tour at
  `logbook/reports/2026-11-03-11-valid-review-tour.md`.
- The constants check was scoped during the build: business constants
  appear only in business, valid and operations (the enforcers), never
  under `apps/`. The rule ids are the shared vocabulary between
  `valid` and the deliveries, so they appear in both.

Handoff 11's Rules and Environment apply unchanged to every item here.
The design rules it added (valid imports only business; problems, not
words; operations and data never import valid; a delivery is a
decoder, a message table and a present module) are now L27.

## The backlog at a glance

Size is Claude's estimate in sessions of the usual length. "Closes"
names the ledger item in the story or the report it retires. The
suggested order is Claude's; the owner's order replaces it.

| # | Improvement | Size | Closes or unblocks | Needs first | Suggested order |
| --- | --- | --- | --- | --- | --- |
| A | The route table as self-describing data | S | entry-chains index (L24), routes-vs-spec test (L26), `operationId`/`x-unit` source | nothing | done, stage 13 (`933871e`) |
| B | The spec's examples as the integration suite | S–M | "example replay" target (chapter 11), the growth of hand-written integration tests | nothing | done, stage 20 (`3b6706d`, `3e2ec75`) |
| C | Statement budgets per entry chain (L11 as a number) | S | gives L11 its sensor; feeds the data spec | nothing | done, stage 21 (`d7c2b02`, `735f3eb`, `7379e68`) |
| D | A `log` port and a request id | S | F5 (`console.error` in `serverFailure`), logging open item (chapter 5) | nothing; pairs with auth's middleware | 4 |
| E | Fail into the envelope: `config:check` in CI, `construct` returns a `Result`, 503 for `unavailable` | M | config-at-load (chapter 2), `unavailable` → 503 (item 41) | the first real config value (auth) | with auth |
| F | A proportional `fakeDbStore` | S | the construct-test fake's growth (chapter 4) | the first area past ~20 store methods | when triggered |
| G | The process step record | S | nothing yet; prepares durable processes (L18) | the first process | with the first process |
| H | Failures carry their parameters | S | the BFF's number-free `limit` wording; the CLI's wording of `limit` | a spec change to `prd/todo/api.md` | with the CLI or auth |
| I | The CLI delivery (stage 12) | M–L | handoff 11, Q7–Q12 | the owner's answers to Q7–Q12 | owner's call |
| J | The data spec | M | pending (L26); the budget's home for C | its form (questions below) | before auth adds tables |
| K | Evaluate RPC over the service binding | M | nothing; a measured lab variant | the CLI's provider/consumer decision | last |
| L | `tooling/` is type-checked: a factory that trusts its checkers should compile them (added at stage 17, Q4) | S | "nothing type-checks `tooling/`" (stage 15 and 16 tours); today it runs only under Node's type stripping | nothing | done, stage 18 (`194d666`) |
| M | `@types/node` in the catalog: `apps/bff` and `tooling/` pin `26.6.6` each, by hand (added at stage 18, Q2) | S | two exact pins that can drift apart | nothing | done, stage 19 (`6879b7a`) |
| N | The join's unit report is checked for staleness against `packages/operations/src` too, not only the test files (carried since stage 16) | S | a report older than the code it tested passes `check:join` | nothing | done, stage 19 (`28162d1`) |

Two things stay exactly as they are and are not on the list: the store
reports facts and the operation decides what they mean; generation
stops at the contract.

## A. The route table as self-describing data

**What changes.** `Route` (in `apps/api/src/http.ts`) carries, beside
the handler, `{ method, path, name, unit }` as plain data: `name` is
the entry point's exported name (`postTodos`), `unit` the name of the
operation or process it runs (`addTodo`), `null` for a probe. Construct
fills them where it already names the handler and the unit.

**What it unblocks.**
- `apps/api/entry-chains.md` (L24, chapter 9) becomes a dump of the
  route table plus the port and data symbols each unit declares. A
  `tooling/entry-chains/generate.ts` builds the route table with the
  fake infra `construct.test.ts` already has, reads only the data
  fields, and writes the index; `--check` regenerates and diffs. The
  file's first line names the script and says not to edit it.
- `operationId` and `x-unit` in `apps/api/openapi.json` come from the
  same data. Check how `tooling/api-spec/emit-openapi.ts` gets them
  today before changing anything.
- A unit test that the set of `METHOD /path` keys in the route table
  equals the keys of `endpoints` from the contract, both ways. Routes
  already take their path from `endpoints` (chapter 11), so the test
  is short; its value is that a route without a spec, or a spec
  without a route, fails `test:unit`.

**Story.** Chapter 4 (the route carries its unit), chapter 9 (the
index is generated, by what), chapter 11 (where `operationId` and
`x-unit` come from). The ledger rows for L24 and the routes-vs-spec
test close.

## B. The spec's examples as the integration suite

**What changes.** One `apps/api/test/integration/examples.test.ts`
replays every example in `packages/contract/api/src/examples.ts`
against the Worker's default export: the request line and body as the
spec wrote them, then the reply's status, `ok`, and for a failure its
`kind`, `field` and `message`. Hand-written integration tests stay only
for what an example cannot express: the 500-todo cap under two
concurrent adds, the 413 before parse.

**The catch to settle first.** Examples that list todos assume state
(two specific todos with fixed ids). Two options:
- replay asserts status, kind, field and message for failures and
  status plus the reply schema for successes, and leaves exact data to
  the hand-written tests (small; start here);
- the spec vocabulary gains a `Given:` section per example that seeds
  rows before the request (a spec change; a later step if the first
  proves too loose).

**Story.** Chapter 11's checks table: "an api test replays each
example" moves from target to done, with the catch recorded.

## C. Statement budgets per entry chain

**What changes.** Two cheap tests, one per level:
- at the data layer, the fake `D1Database`
  (`packages/data/d1/test/unit/fake-d1.ts`) already records every
  statement, so each store method's test asserts how many statements
  it sends (`addTodoUnlessFull` = 1, `deleteCompleted` = 1 batch);
- at the construct level, a counting `DbStore` wrapper asserts port
  calls per entry chain (`POST /todos` = 1), and in the BFF a counting
  fake api client asserts api calls per page load (`/active` = 2).

**Where the budget is written.** Until the data spec exists (J), a
`budgets.test.ts` keyed by entry chain is the record. When J exists,
each store call's entry carries its cost line and the test reads from
there.

**Story.** Chapter 6 or 8, under L11: performance is a design input
*and* a number the cheap tier checks.

## D. A `log` port and a request id

**What changes.**
- `constructInfra` builds a `log` once per isolate, like the id source.
- The per-request half (`http.ts`) mints a request id and binds a
  request-scoped logger onto Hono's context var, so handlers and
  `present.ts` never import a logger.
- `serverFailure` logs through it, one JSON line:
  `{ requestId, method, path, kind, message, chain }`, the chain being
  the `cause` list down to the root.
- `construct.test.ts` injects a fake `log` and asserts the line's
  shape for a stubbed failing operation.

**Pairs with.** Auth's middleware, which needs the same request id for
audit, and the readiness probe, which logs which dependency failed
(chapter 5, L20).

**Story.** Chapter 1 (what the per-request half holds beyond the body
limit), chapter 4 (infra gains `log`), chapter 5 (logging shared with
middleware), chapter 13 (F5 closes).

## E. Fail into the envelope, not out of it

**What changes.** Two halves:
- `tooling/config-check/`: reads the same config schema the api uses
  and checks the deploy's variables (`.dev.vars` locally, the CI
  secrets in the workflow), so a bad deploy never ships. The workflow
  stays pinned by SHA (rl-0011).
- `readConfig(env)` returns a `Result`; `construct` returns one too;
  on failure `index.ts` serves an api whose every route answers an
  `unavailable` envelope, so callers get our shape, not Cloudflare's
  page.

**The spec change it needs.** `unavailable` is `internal` 500 today
because the PRD's envelope has no kind for it. Adding `unavailable`
503 with `Retry-After` is a PRD deviation and a line in
`prd/todo/api.md`'s Errors section, then `gen:api`. Record the
deviation first.

**Needs first.** The first real environment value, which auth brings
(provider keys, allowed origins). Do not build the config half on an
empty config.

## F. A proportional `fakeDbStore`

**What changes.** `fakeDbStore(partial)` returns a `Proxy` that serves
the methods the test stubbed and fails loudly (a thrown test error is
fine; it is a test bug, not a request-path failure) on any other. The
array-backed fake in `apps/api/test/unit/construct.test.ts` becomes
one `partial` per test. The "every method listed" unit test in
`packages/data/d1` stays as the collision guard.

**Where it lives.** It is typed by `DbStore` and used by the api's
tests; either `packages/data/d1/test/` with a test-only subpath export,
or `apps/api/test/unit/`. The agent proposes; the owner names.

**Trigger.** The first area past about twenty store methods, or the
users area, whichever comes first.

## G. The process step record

**What changes.** One type, written with the first process:
`Step<T> = { name, attempt, started, finished, result: Result<T, AnyFail> }`
and a process result that lists its steps. Immediate and durable
processes (L18) share it, so moving a process to Cloudflare Workflows
later changes the runner and nothing in the process. This is the
"state decoupled from execution" theme applied inside the app.

**Pairs with.** "Notify on add" or the sign-up email, whichever is the
first process (handoff 11, chapter 6 target).

## H. Failures carry their parameters

**What changes.** `limitReached` in `packages/fail` takes `{ max }`
beside its message, as `title.too_long` carries `max`. The api exposes
it on the wire only when `prd/todo/api.md` says `limit: 409, with max`
and the contract is regenerated. The BFF (and the CLI) then word the
limit from the reply, not from a constant, which restores the number
to "the list is full" without breaking L27.

**Recorded as** profile-notes P53 in stage 11; this item is its
brief.

## I. The CLI delivery

Designed in handoff 11 (Stage 12). Starts on the owner's answers to
Q7–Q12 there, the first being whether a second provider of the same
operations is allowed by the story ("adding a todo has one authority",
chapter 12).

## J. The data spec

**What it is.** The pending half of L26: one entry per store call,
stating what the call promises and not how. Each entry: the port
method it satisfies; the use cases that use it; input and result in
business types or a named read shape; the guarantee (what it keeps
atomic, the isolation it needs, the order it returns, whether a retry
is safe); the failures it can name; its cost (round trips, the rows it
expects, the index it relies on). Nothing is generated from it; SQL
stays hand-written. A conformance suite holds one test per guarantee,
run against D1 now and Postgres later.

**Questions to settle first.**
- One file per data package (`prd/todo/data/d1.md`), mirroring one api
  spec per api, or one per area.
- Whether read shapes (`TodoCounts`) live in business beside entities
  or in a sibling folder; chapter 7's open list already asks.
- Whether the BFF's composition (a view per route naming the endpoints
  it reads) gets its own spec or stays in the BFF story.

**Why before auth.** Auth adds tables, scoped queries and indexes; the
entries are cheaper to write for three store calls than for twenty.

## K. Evaluate RPC over the service binding

**What it is.** A lab variant, not a story change: the api exports a
typed `WorkerEntrypoint` beside its HTTP surface, the BFF binds to it,
and the lab measures latency and what is lost (the envelope, OpenAPI,
the CLI as a consumer). Recorded like P15, as a deliberate pair, with
the measurement deciding.

**Needs first.** The CLI's provider-or-consumer decision, since a
consumer CLI over `fetch` is the strongest argument for keeping HTTP.

## Open, carried

Everything under "Open, carried" in handoff 11 still carries. Added:
- The report's section 14, the auth readiness table, is in the
  planning chat's doc, not in the repo. The one decision that shapes
  the rest: where the actor enters the chain. Claude's reading of the
  story favours an `Actor` input every operation takes, validated at
  the entry point through `valid`, with middleware doing only the
  identification. To be settled in auth's own session, before its use
  cases are written.
