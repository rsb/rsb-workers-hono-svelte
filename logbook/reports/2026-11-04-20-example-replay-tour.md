# Review tour: stage 20 (the spec's examples as the integration suite), 2026-11-04

Claude wrote this tour of stage 20 for the owner to review against the
code. It is a written tour; nobody led it live. Stage 20 does handoff
12's row B: one integration test file replays every example in
`prd/todo/api.md` against the Worker, and the hand-written tests it
covers are removed.

The code is on `test/example-replay`, made from `main` at `342efd2`,
the merge of PR #41, and merged as PR #42 (`accdb4a`):
- `3b6706d` `test(api)`: the replay and its guard, and the contract's
  `./examples` export.
- `3e2ec75` `test(api)`: three hand-written tests removed, and
  `too-large.test.ts` retitled.

The `docs(logbook)` commit was meant to be the branch's third. PR #42
was pushed and merged before it was made, so it is on
`docs/example-replay`, made from `main` at `accdb4a`: this tour,
handoff 12's row B, the story, the profile notes and handoff 20.

Checks after `3e2ec75`, each in a fresh command:
- `pnpm check` exits 0.
- `pnpm check:api`, `pnpm check:entry-chains` and `pnpm check:rules`
  exit 0.
- `pnpm test:tooling`: 159 pass.
- `pnpm test:unit`: every package passes. `valid` has 57 and
  `apps/api` has 59.
- `pnpm check:join`, run after `test:unit`, exits 0.
- `pnpm test:integration`: 46 pass, in 12 files.
- `pnpm test:e2e`: 41 pass.

Only the integration count moved: from 29 to 46. Up 20, for the 18
endpoint examples, the 413 and the guard; down 3, for the removals.
`health.test.ts` went, and `examples.test.ts` came, so there are still
12 files.

"Why" cites handoff 20's questions and the owner's answers:

| Question | Owner's answer |
|---|---|
| Q1, what a success asserts | Status, plus the reply parses with the endpoint's reply schema; exact data stays hand-written |
| Q2, the examples that need state | Seed through the store, not the table: `createDbStore(db).addTodoUnlessFull` with a `Todo` carrying the example's id. The table stays private to data/d1, and the seed breaks when the store does. "The list is full" stays on the not-replayed list, covered by the `todos.cap` test |
| Q3, the shared examples | Replay the 413 with `BODY_LIMIT_BYTES + 1` on one endpoint; the 500 goes on the not-replayed list |
| Q4, the hand-written tests | Remove those the replay covers, in their own commit; rule-id-titled tests stay. At the commit, the owner kept `too-large.test.ts` too (section 2) |
| Q5, the contract's `firstIssue` mirror | Keep it, as the unit-tier early warning for a bad example |
| Q6, the join and the integration report | Not this stage; this tour names where `todos.cap`'s integration test lives (section 3) |

The owner also asked that "replayed or on the named not-replayed list,
else fail" be a test, not a convention. It is: section 1's guard.

## 1. The replay

Commit `3b6706d`: `apps/api/test/integration/examples.test.ts`,
`packages/contract/api/package.json`.

- **What:**
  - One test per example, named `<endpoint key>: <example name>`, from
    `examples`. The shared ones are named `every endpoint: <name>`.
  - `toRequest` (`examples.test.ts:35`) sends the request as the spec
    wrote it: the path, each query pair appended in order (so "given
    twice" goes out twice), and the body as JSON when there is one.
  - `check` (line 72) asserts the status. Then:
    - a success, which is the endpoint's own status, must parse with
      `success(endpoints[key].reply)`;
    - anything else must equal the example's whole reply: `ok`,
      `kind`, `field` when given, and `message`.
- **Why schema-only for successes (Q1):** the examples share one
  database (DB9), and the spec does not say what each starts from.
  "Lists every todo" names two todos with fixed ids; the replay cannot
  answer them without a `Given:` for each example, which is handoff
  12's second option and a spec change.
- **The seed (Q2),** `seed` (line 53): before a succeeding example
  whose path names an `id`, a todo with that id goes in through
  `createDbStore(env.DB).addTodoUnlessFull`, titled `seeded`. Two
  things the handoff did not foresee:
  - **only before a success.** "No todo has the id" names `missing`
    in its path; seeded, it would answer 200. So the seed runs only
    when the example's status is the endpoint's success status.
  - **skipped when the id is there.** "Renames a todo" and "removes a
    todo" name the same id, in one file's database. The seed lists the
    todos through the store first and skips an id already present. A
    second insert would be a primary-key failure.
- **The shared examples (Q3):** `sharedRequests` (line 30) says how a
  shared example, which has no request, is sent. "A body over the
  limit" goes to `POST /todos` with `BODY_LIMIT_BYTES + 1` bytes, and
  must answer the example's whole 413 reply.
- **The not-replayed list,** `notReplayed` (line 23), each entry with
  what covers it:
  - `POST /todos: the list is full`:
    `todos-limit.test.ts`, `todos.cap: the 501st todo is rejected with
    limit`, which needs 500 adds first;
  - `every endpoint: the server fails`: nothing yet; no request makes
    the api fail without a fault port.
- **The guard** (line 115), a test of its own:
  - an entry in `notReplayed` that names no example fails it, so the
    list cannot outlive what it excuses;
  - an example both replayed and listed fails it;
  - every example is replayed or listed;
  - a shared example with neither a sender in `sharedRequests` nor a
    list entry fails it, and its replay case fails too, saying
    "has no way to be sent; add it to sharedRequests or notReplayed".

  A new **endpoint** example is not refused: it is replayed as soon as
  it is generated, and fails the suite only if the api does not answer
  it as written. To excuse it, it goes on the list.
- **The proof,** shown to the owner before the commit, each from a
  scratch edit of the test file, restored byte for byte after:
  - a copy of the examples with one expected message changed failed
    `POST /todos: the title is empty`: `- "title is blank"`,
    `+ "title is empty"`;
  - a fake list entry and a renamed sender failed the guard on
    `POST /todos: a todo nobody wrote`, and the 413 with "has no way
    to be sent". The generated `examples.ts` was not touched.
- **The contract's `./examples`:** `packages/contract/api/package.json`
  exports `./examples` beside `.`. `index.ts` still does not export
  the examples, so the BFF's import of the contract does not carry
  them. A workspace package's `exports` needs no install.

## 2. The hand-written tests

Commit `3e2ec75`: `health.test.ts`, `todos-filter.test.ts`,
`todos-toggle.test.ts`, `too-large.test.ts`.

**The growth rule:** a hand-written test stays when it sends a request
no example sends, asserts more than the replay does, or proves a
decision. A test titled with a rule id stays by the same rule.

Removed, each sent the request an example sends and asserted no more
than the replay asserts:

| Removed | Replaced by |
|---|---|
| `health.test.ts`, "GET /health returns ok" | `GET /health: the api is up`. `HealthReply` is `ok: literal(true)`, so the schema check is the exact reply |
| `todos-filter.test.ts`, "GET /todos with a bad completed is refused, naming the field" | `GET /todos: completed is not true or false` |
| `todos-toggle.test.ts`, "PATCH /todos/:id answers not_found for an id no todo has" | `PATCH /todos/{id}: no todo has the id` |

Kept, though close to an example:
- **`too-large.test.ts`,** retitled "the body limit runs before routing:
  413 on a path with no route, D16". It proves a decision. D16 says an
  oversized body is a 413 on any path, before routing (chapter 1). The
  replay sends its 413 to `POST /todos`, a matched route, so a body
  limit that ran only inside routes would pass the replay and break
  D16. Claude first removed it; the owner kept it at the commit.
- **`todos-edit.test.ts`,** "answers not_found when renaming an id no
  todo has": it sends a `title` body; the example sends `completed`.
  The handler is the same, the request is not.
- **`todos-delete.test.ts`,** the not_found test: it also sends an id
  already deleted, which no example does.
- **`todos-mark-all.test.ts`,** "a body without completed": it sends
  `{}`; the example sends `"yes"`.
- **`todos-clear-completed.test.ts`,** "DELETE /todos without
  completed=true": it sends no query, and asserts nothing was deleted.
  The example sends `completed=false`.
- **Every success test that checks exact data,** order or trimming
  (`todos-add`, `todos-list`, `todos-edit`, `todos-mark-all`, the rest
  of `todos-filter` and `todos-toggle`): under Q1 that stays here.
- **`todos-limit.test.ts`:** a rule id, and the cover for "the list is
  full".
- **`not-found.test.ts`:** no example has an unknown route.

## 3. Noted for the review

- **The join and the integration report (Q6).** `todos.cap`'s
  integration test lives in `apps/api/test/integration/todos-limit.test.ts`,
  titled `todos.cap: the 501st todo is rejected with limit`. Today the
  integration tier writes no report. Picking it up means a JSON
  reporter in `apps/api/vitest.integration.config.ts`, writing
  `apps/api/test-results/integration.json` as operations' unit config
  does, and the report and its watched directories added to
  `check:join`'s arguments (`apps/api/test/integration apps/api`,
  where `readReport` already takes any number of directories since
  stage 19).
- **`firstIssue` stays (Q5).** `packages/contract/api/test/unit/examples.test.ts`
  mirrors the api's validation to predict each failure's field and
  message. It is the unit-tier early warning for a bad example: a
  wrong message in the spec fails there, without a Worker, before the
  replay runs. It is not a duplicate: the replay proves the api, the
  mirror proves the example agrees with the contract's schemas. If the
  api's validation changes, the mirror can go wrong while the replay
  still tells the truth.
- **The seed's title is `seeded`.** No succeeding id example's schema
  check looks at it. If Q1 ever becomes exact data, the seed needs the
  example's state, which is the `Given:` the spec does not have.
- **The seed uses `TODO_LIMIT`** from `@todo/business/rules.ts`. Only
  to seed; `todos-limit.test.ts` still proves the PRD's number without
  importing it.
- **The 500.** Nothing replays it. A fault port, or a test-only
  binding that makes the store fail, would let it come off the list.
- **No decision was recorded.** The replay applies DB9 and row B as
  written. L36 stays free.
- **The wrangler telemetry** that `apps/api` and `apps/bff` try to send
  during `check`, integration and e2e was refused by the sandbox. It
  has no effect on the result.

## 4. Story delta

Chapters changed:
- **1, Startup:** D16's line says `too-large.test.ts`
  proves the 413 on a path with no route, which the replayed example
  cannot.
- **11, Contracts:**
  - the examples bullet says tests import `@todo/contract-api/examples`;
  - the checks list: "an api test replays each example" moves from
    target to done, with the catch (Q1), the seed (Q2), the
    not-replayed list, the guard and the growth rule.

Also changed:
- **Handoff 12:** row B is marked done.
- **Profile notes:** P66, the replay as the integration suite, with
  its guard and the growth rule.

Not changed:
- Chapters 0, 2–10, 12 and 13. None describes the integration suite's
  makeup.
- The spec-levels table (chapter 11) already says the api spec is
  bound by "the examples replayed".
- The glossary. It has no entry for the integration tests.
