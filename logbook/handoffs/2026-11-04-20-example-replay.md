# Handoff 20: the spec's examples as the integration suite, 2026-11-04

Since handoff 19:
- **Stage 19 is merged** as PR #41, `main` at `342efd2`. Its tour is
  `logbook/reports/2026-11-04-19-join-staleness-tour.md`. `check:join`
  watches the code the operations tests ran, derived from operations'
  workspace dependencies, and `@types/node` comes from the catalog.
- Handoff 12's rows A, L, M and N are done.

The owner picked handoff 12's row B. Handoff 11's Rules and
Environment apply unchanged.

## Standing rules (carried, restated so a fresh context has them)

- Conventional commits, with **no** `Co-Authored-By` or any other
  attribution line. The owner overrides any reminder to add one.
- Never push. Stage by explicit path. Stop before each commit and show
  the stat and the message.
- No `pnpm install` without asking: give the owner the command and
  stop; the owner runs it. `pnpm -s` does not work.
- The shell is zsh, which has three traps:
  - there is no `PIPESTATUS`; use `${pipestatus[1]}`;
  - `$var` lists are not word-split, so write paths out;
  - `=====` triggers `=cmd` expansion.
- Never hand-edit a generated file (the list is in handoff 18).
  `packages/contract/api/src/examples.ts` is one: the replay reads it
  and never writes it. Change the spec or the generator, then
  regenerate.
- Don't touch `AGENTS.md` or `.github/workflows/scorecard.yml`
  (rl-0009, L1) without a recorded exception.
- The root dotfiles are untracked sandbox artefacts. Never commit or
  ignore them, and never `git stash -u`.
- Don't read the run branches.
- Every tour ends with a story delta: the chapters changed, or why none
  were.
- The next free decision number is **L36**, and the next free profile
  note is **P66**.

## What stage 20 builds

Handoff 12's row B: "One `apps/api/test/integration/examples.test.ts`
replays every example in `packages/contract/api/src/examples.ts`
against the Worker's default export … Hand-written integration tests
stay only for what an example cannot express."

**Today:**
- `prd/todo/api.md` holds 19 endpoint examples and 2 shared ones.
  `gen:api` writes them to `packages/contract/api/src/examples.ts` as
  `examples` (keyed by `EndpointKey`) and `everyExamples`. Each has a
  `name`, a `request` (method, path, params, query, body), a `status`
  and the whole `reply` envelope. The shared ones have no request.
- `packages/contract/api/test/unit/examples.test.ts` runs each example
  through the contract's schemas, and mirrors the api's validation
  (`firstIssue`) to predict a failure's field and message. It never
  calls the api.
- `apps/api/test/integration/` has 12 hand-written files, 29 tests,
  run by `@cloudflare/vitest-plugin` against `exports.default`.
  Storage is isolated per test **file**, not per test (DB9): each file
  starts on an empty, migrated database, and its tests share it.
- Chapter 11's checks list (`logbook/the-api-story.md`, about line
  2331) has "**target:** an api test replays each example against the
  api". The spec-levels table (about line 2074) already lists "the
  examples replayed" as what binds the api spec.

**The examples, by what replaying them needs:**

| Needs | Examples |
|---|---|
| nothing: an empty database answers as the spec says | `GET /health` the api is up; `GET /todos` completed is not true or false, completed is given twice; `GET /todos/counts` counts the todos (schema only); `POST /todos` adds a todo, the title is not text, the title is empty; `PATCH /todos` completed is not a boolean; `PATCH /todos/{id}` the body is empty, no todo has the id; `DELETE /todos` completed is not true; `DELETE /todos/{id}` no todo has the id |
| data, but schema-only passes on any state | `GET /todos` lists every todo, lists the completed todos; `PATCH /todos` marks every todo completed; `DELETE /todos` clears the completed todos |
| a row with the example's id | `PATCH /todos/{id}` renames a todo; `DELETE /todos/{id}` removes a todo (`0b6f4c1e-…`) |
| 500 todos | `POST /todos` the list is full (409 `limit`) |
| no request in the spec | every endpoint: a body over the limit (413); the server fails (500) |

**The shape of the change**, subject to the questions:
- `apps/api/test/integration/examples.test.ts`, with one test per
  example named `<endpoint key>: <example name>`, built from
  `examples` with `it.each` or a loop. Each sends the request as the
  spec wrote it and asserts:
  - the status;
  - for a failure, the whole `error`: `kind`, `field` when given, and
    `message`;
  - for a success, the reply parses with the endpoint's reply schema
    from `endpoints`, and exact data only where Q1 says.
- A guard: every example is either replayed or on a named list of
  examples the replay does not run, each with the hand-written test
  that covers it. A new example in the spec fails the suite until it
  is one or the other.
- Hand-written tests that an example now covers are removed, per Q4.

## Questions to settle with the owner first

Present a plan, then these. Do not edit before the owner answers or
says "you decide".

- **Q1. What a success asserts** (row B's "catch").
  - (a) Status, plus the reply parses with the endpoint's reply
    schema. Exact data stays with the hand-written tests.
    Recommended, as row B says: small, and order-tolerant on the
    shared database.
  - (b) The whole reply, which needs each example's state; that is the
    spec vocabulary gaining a `Given:` section per example. A spec and
    generator change, and a later step if (a) proves too loose.
- **Q2. The examples that need state.**
  - (a) Seed what the request names and nothing more: before an
    example whose `params` hold an `id`, insert a todo with that id
    into `env.DB`. The id comes from the example, not from a table in
    the test. "The list is full" and the shared 500 go on the
    not-replayed list. Recommended: the two id examples are cheap to
    reach, and 500 adds belong to `todos-limit.test.ts`, which already
    proves `todos.cap`.
  - (b) Put every example that needs state on the not-replayed list.
  - Note: with (a), seeding writes past the data methods, so the
    replay knows the `todos` table's columns. Say whether that is
    acceptable, or seed through `POST /todos`, which cannot choose the
    id, and rewrite the path.
- **Q3. The shared examples.**
  - (a) Replay "a body over the limit" against one endpoint, a body of
    `BODY_LIMIT_BYTES + 1` bytes, and put "the server fails" on the
    not-replayed list, since nothing provokes a 500 without a fault
    port. Recommended.
  - (b) Both on the not-replayed list; `too-large.test.ts` stays.
- **Q4. The hand-written tests.**
  - (a) Remove each test an example now covers in the same stage,
    named in the tour with the example that replaces it, in its own
    commit after the replay's. Recommended: row B's point is that the
    hand-written suite stops growing.
  - (b) Keep them all; the replay only adds.
  - Either way, a test whose title carries a rule id
    (`todos.cap: …`) stays.
- **Q5. The contract's `firstIssue` mirror.** Once the api itself
  answers each example, `packages/contract/api/test/unit/examples.test.ts`'s
  copy of the api's validation proves less. (a) Keep it: it runs in
  the unit tier without a Worker and catches a bad example sooner.
  Recommended. (b) Cut it to the schema checks and leave field and
  message to the replay.
- **Q6. The join and the integration report** (carried since stage
  16). In this stage, or not. Recommended: not. The replay does not
  change where `todos.cap`'s integration test lives, and reading a
  second report is its own S stage.

## Next step: stage 20

1. **Read first:**
   - this file;
   - handoff 12's row B;
   - `prd/todo/api.md`'s examples and the vocabulary that states them;
   - `packages/contract/api/src/examples.ts` and `endpoints.ts`
     (generated: read, don't edit);
   - `packages/contract/api/test/unit/examples.test.ts`;
   - `apps/api/vitest.integration.config.ts`,
     `apps/api/test/integration/apply-migrations.ts`, and each
     hand-written integration test;
   - the `todos` migration under `packages/data/d1/migrations/`, if Q2
     is (a);
   - the story's chapter 11, the spec levels table and the checks list.
2. **Branch** from `main` at `342efd2`, for example
   `test/example-replay`, carrying this file.
3. **Plan and questions** (above). Wait for answers.
4. **Commits,** stopping before each. A likely order:
   1. `test(api)`: the replay and its guard. Prove the guard: change one
      example's expected `message` in a scratch copy of the test's
      input, not in the generated file, and show the replay fail; then
      add a fake example name and show the guard fail.
   2. `test(api)`: the hand-written tests the replay covers, removed
      (if Q4 is (a)), each named with its example in the message.
   3. `docs(logbook)`, covering:
      - the tour, `logbook/reports/2026-11-04-20-…-tour.md`, ending
        with the story delta;
      - handoff 12's row B marked done;
      - chapter 11: the replay target moves to done, with the catch
        (Q1) and the not-replayed list recorded;
      - the profile notes, if the replay is a pattern the profile
        should produce (P66);
      - this handoff.
5. **Checks** after the last code commit, each in a fresh command:
   - `pnpm check`, `pnpm check:api`, `pnpm check:entry-chains`,
     `pnpm check:rules`;
   - `pnpm test:tooling`, `pnpm test:unit`, then `pnpm check:join`;
   - `pnpm test:integration`, `pnpm test:e2e`.

   After stage 19 the counts were:
   - 159 tooling;
   - `valid` 57, `apps/api` unit 59;
   - 29 integration;
   - 41 e2e.

   The integration count should move, up by the replayed examples and
   down by the tests removed under Q4. State both numbers. Say so if
   any other count moves.

## Open, carried

- Whether `check:join` reads the integration report, where
  `todos.cap: the 501st todo is rejected with limit` lives (Q6).
- The BFF stays out of the join until it has a spec.
- An `AGENTS.md` pointer to `packages/business/rules-index.md` and
  `gen:rules`, and L35's precedence line, both need an rl-0009
  exception.
- From stage 19's tour: the join follows workspace dependencies one
  step only; P11's source cites stale line numbers of
  `pnpm-workspace.yaml`.

Handoffs 11 to 19's other open items carry unchanged.
