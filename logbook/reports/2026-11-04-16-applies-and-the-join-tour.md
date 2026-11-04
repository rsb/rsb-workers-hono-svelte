# Review tour: stage 16 (`Applies:`, the validator's rules and the join), 2026-11-04

Claude wrote this tour of stage 16 for the owner to review against the
code. It is a written tour; nobody led it live. Stage 16 builds the
rest of L33. Stage 15 did the id rename and the use-case lint. This
stage makes what an entry point applies into data, in three places:
- `Applies:` in the api spec;
- `rules` on each validator;
- the validator its route gives the handler.

`pnpm check:join` joins them to the use cases, and joins each state
rule to a passed test named by its id.

The branch is `feat/rules-join`, made from `main` at `da116a6` (PR #36
merged). It has seven commits, one more than handoff 16 planned, because
the CI change has its own commit, as in stage 13:
- `f3b232d` `feat(api-spec)`: `Applies:` in `api.md` and its parser.
- `de5d5d1` `feat(rules)`: each validator's `rules`, generated.
- `38840a0` `refactor(api)`: the route gives each handler its
  validator, and the readers follow.
- `8d001c2` `test(operations)`: the state rules' tests are named by id,
  and the unit report is written.
- `aa7f17d` `feat(tooling)`: the join, `pnpm check:join`.
- `361ce39` `ci`: `check:rules` and `check:join` in `scorecard.yml`,
  under the rl-0009 exception recorded in §6.
- the seventh commit, `docs(logbook)`: the story, the glossary, the
  profile notes, this tour and handoff 16.

Checks after `361ce39`, each in a fresh command:
- `pnpm check` exits 0.
- `pnpm check:api` exits 0.
- `pnpm check:entry-chains` exits 0.
- `pnpm check:rules` exits 0.
- `pnpm test:tooling`: 155 pass (123 before).
- `pnpm test:unit`: every package passes. `valid` has 57 (53 before)
  and `apps/api` has 59 (unchanged).
- `pnpm check:join`, run after `test:unit`, exits 0.
- `pnpm test:integration`: 29 pass (unchanged).
- `pnpm test:e2e`: 41 pass (unchanged).

Why the counts moved:
- **Tooling, +32:**
  - 3 in api-spec's parser (commit 1);
  - 8 net in entry-chains (commit 3);
  - 21 in the join (commit 5).
  
  Commit 2 added an assertion to an existing test, not a test.
- **`valid`, +4:** one `rules` test per validator (commit 2).
- **The rest:** commit 4 renamed tests without adding any, so the other
  counts did not move.

"Why" cites handoff 16's questions and the owner's answers:

| Question | Owner's answer |
|---|---|
| Q1, where the join lives | Its own tool, `tooling/join`, run as `pnpm check:join`, reusing the other tools' readers |
| Q2, how the route carries its validator | The handler takes it as an argument, so the declaration is true by construction; `Route` derives the rules from the validator it holds rather than storing a copy |
| Q3, how a test names its rule | By id, `todos.cap: …`; the join requires a pass, not just a name. The join never runs vitest: `test:unit` writes a JSON report to a known path, the join reads it and refuses it when missing or older than the tests, and CI runs `test:unit` first. The integration test is named too; reading its report stays open |
| Q4, validators that apply no rule | `Applies: none` written out; Applies and rules compared as sets, each id once |
| Q5, the BFF | Stays out until it has a spec |
| Q6, the CI step | `check:rules` and `check:join` as CI steps now, under an rl-0009 exception recorded in this tour, as stage 13 did; the repo-run test stays as the local proof |

## 1. `Applies:` in the api spec

Commit `f3b232d`: `prd/todo/api.md`, `tooling/api-spec/parse.ts`.

- **What:**
  - Each endpoint whose route runs a unit has an `Applies:` line after
    `Serves:`:
    - `POST /todos`: `title.length`;
    - `PATCH /todos/{id}`: `patch.nonempty`, `title.length`;
    - the other five: `none`.
    
    `GET /health` is a probe and has no line.
  - The parser reads `Applies:` as the second part, as `Endpoint.applies`:
    - `undefined` when the line is absent;
    - `[]` for `none`;
    - otherwise the ids.
  - An id that is not in code font, or that does not look like
    `<subject>.<property>`, fails. So does an id named twice.
  - The list reader, `parseList`, is shared with `Errors:`, so the two
    parts read their lists the same way.
- **Why:** L33. Q4 says `none` is written out, so an endpoint that
  forgot the line is told apart from one that applies nothing.
- **The contract is unchanged.** `Applies:` is read but never emitted,
  so `check:api` passes with no regenerated file.

## 2. The validator's rules

Commit `de5d5d1`: `tooling/rules/emit.ts` and the four generated
validators.

- **What:**
  - Each validator now carries
    `toNewTodo.rules = ["title.length"] as const satisfies readonly RuleId[];`.
  - The order is the input's rules first, then its fields' rules in
    field order, each id once. That is the order the validator runs
    them in.
  - `toTodoPatch.rules` is `["patch.nonempty", "title.length"]`, and
    `toTodoFilter` and `toCompleted` carry `[]`.
- **Why:** L33, item 2 of the handoff. The emitter already knew each
  rule, so this is generated, never written by hand.
- **Boundary:** `RuleId` is a type import from `@todo/business`, so
  `valid` still imports only business.
- **Tests:**
  - Each `valid` test file checks its validator's `rules`.
  - The custom-rule fixture in `generate.test.ts` now asserts
    `["title.length", "title.plain"]`, which shows a custom rule is
    listed too.

## 3. The route gives the handler its validator

Commit `38840a0`: `apps/api/src/http.ts`, `construct.ts`, four handlers
and their tests, `tooling/entry-chains/`.

- **What:**
  - `Route` gains `validator: { name, value } | null`, where `value` is a
    `Validator`: a function that carries `rules`. The route holds the
    validator itself, and its rules are read from it, not copied
    (Q2's refinement).
  - The construct now builds four routes with a validator:
    - `route({ postTodos }, { addTodo }, { toNewTodo })`;
    - `getTodos` with `toTodoFilter`;
    - `patchTodos` with `toCompleted`;
    - `patchTodo` with `toTodoPatch`.
    
    `route` builds the handler with `build(unit, validator)`. The
    counts route and the two deletes keep two arguments.
  - Each of those four handlers takes its validator as its second
    argument and imports only its type (`type ToNewTodo = typeof
    toNewTodo`). Their unit tests pass in the real validator.
- **True by construction:**
  - The second overload types the validator argument as the handler's
    own second parameter, so the declaration cannot drift from what
    runs.
  - I checked by hand, with `@ts-expect-error` lines in a scratch file,
    that `tsc` refuses each of these:
    - a route with no validator for a handler that takes one;
    - the wrong validator;
    - a validator for a handler that takes none;
    - the wrong unit.
  - The scratch file is not committed.
- **The readers follow:**
  - `entry-chains/read.ts` reads the optional third argument.
  - `routes.ts` takes each row's validator name and `rules` from the
    loaded construct.
  - The text check requires the name to be construct's import from
    `@todo/valid/`, written by its own name.
  - The index's `rules` row now comes from the route's validator, not
    from the handler's imports.
  - `chains.ts` fails when a handler imports a value from `@todo/valid/`,
    so a handler cannot call a validator the route does not give it.
  - `apps/api/entry-chains.md` is byte for byte unchanged, which is the
    proof that the rows are the same.
- **Changed without being asked:** the error message for a route line
  the reader cannot read now names the three-argument form.

## 4. The named tests and the unit report

Commit `8d001c2`: `packages/operations`.

- **What:**
  - `vitest.unit.config.ts` adds the JSON reporter, which writes
    `packages/operations/test-results/unit.json`. `test-results/` was
    already ignored.
  - Three unit tests and one integration test are renamed:
    - `todos.cap: names a limit failure when the store did not insert`
      (`add-todo.test.ts`);
    - `todo.exists: names a not_found failure when the store has no
      such todo` (`update-todo.test.ts`);
    - `todo.exists: names a not_found failure when the store deleted
      nothing` (`delete-todo.test.ts`);
    - `todos.cap: the 501st todo is rejected with limit`
      (`apps/api/test/integration/todos-limit.test.ts`).
- **Why:** Q3. The id leads the name, so the join reads it without a
  tag or a `describe` per id. `todos.cap` is kept atomic by the D1
  store, so the integration test is its strongest proof. That test now
  carries the id, but the join does not read its report yet (open).

## 5. The join

Commit `aa7f17d`: `tooling/join/`, the root `check:join` script.

- **What:**
  - **`check.ts`** reads the inputs with each tool's own reader:
    - `rules.md` with the rules parser;
    - the use cases with `readUseCases`;
    - `api.md` with the api-spec parser;
    - construct with `readRoutes`.
    
    If any input does not read, it fails and names why. It writes
    nothing.
  - **`join.ts`** collects every problem, not only the first. For each
    endpoint with a route:
    - A route that runs a unit has `Applies:`, and a probe has none.
    - Each id in `Applies:` is a rule, and an input rule.
    - `Serves:` names one use case file, and `Applies:` covers every
      id that use case `Assumes`.
    - The validator's `rules` equal `Applies:` as sets, and a route
      given no validator applies none.
    
    And for the tests:
    - Each `Given` id has at least one test named `<id>: …` in the
      report, and every such test passed.
    - A test named by an id that is not a state rule fails, so a
      misspelling such as `todos.capp` cannot pass as unnamed.
  - **`report.ts`** reads vitest's JSON report. It refuses a report
    that:
    - is missing ("run pnpm test:unit first");
    - is older than any file under the tests directory ("run pnpm
      test:unit again");
    - is not JSON, or not a test report.
    
    It never runs vitest (Q3).
- **Tests, 21:**
  - 13 join cases, one per problem, plus the agreeing inputs and the
    set comparison;
  - 4 report cases on temporary files;
  - 2 `namedBy` cases;
  - 2 on the repo. The repo must join with no problem other than the
    report's own, and the run passes when the report is fresh. CI runs
    `test:tooling` before `test:unit`, so there the report is missing,
    and the test allows for that. I ran it both with and without a
    report.
- **By hand on the repo:**
  - I set `POST /todos` to `Applies: none`. The join named both
    problems: it does not cover `title.length`, and `toNewTodo` applies
    a rule `Applies:` leaves out. Then I restored `api.md`.
  - With the report deleted, the join named the missing report and the
    command that writes it.
- **Left to other checks:** an endpoint with no route, or a route with
  no endpoint, is `check:api`'s, so the join skips it. A cited id that
  does not exist in a use case is `check:rules`'s.

## 6. CI and the governance change (rl-0009 exception)

**Recorded exception, rl-0009.** The owner decided this in the stage
16 answers (Q6). It is in its own commit, `361ce39`:
- `.github/workflows/scorecard.yml` gains two steps:
  - `pnpm check:rules`, after `pnpm check:entry-chains`, beside the
    other generator checks;
  - `pnpm check:join`, after `pnpm test:unit`, which writes the report
    the join reads.
- No action is added or changed, so the SHA pins and
  `permissions: contents: read` are as they were (rl-0011).
- No secret is involved (rl-0012).
- The workflow's header says every stage added later is a recorded
  change in the logbook; this section is that record.
- `AGENTS.md` is not changed. The pointer to the rules index and
  `gen:rules`, and L35's precedence line, stay open for the owner.

## 7. Noted for the review

- **Only test files are checked for staleness.** The join compares the
  report's age with the files under `packages/operations/test/unit`,
  as Q3 said. If an operation's source changes after `test:unit` ran,
  the report is not refused. In CI, `test:unit` runs on the same
  checkout just before the join, so this only matters locally.
- **The negative typing is not a regression test.** The `tsc` refusals
  in §3 were checked once, by hand. Nothing in the repo keeps them
  failing. A committed type test (a `@ts-expect-error` file under
  `apps/api`'s `tsc`) would. I did not add one without asking.
- **`Serves:` is resolved from `api.md`'s directory.** The join treats
  the endpoint's one backticked `.md` path as relative to
  `prd/todo/`. A `Serves:` naming two paths, or none, is "serves no
  use case the join can read".
- **The BFF stays out (Q5).** Its actions call the same validators
  directly, and nothing joins them until the BFF has a spec.
- **`gen:rules` prints "wrote" for every file,** changed or not. This
  is cosmetic, and left as is.

## 8. Story delta

Chapters changed:
- **The opening:** L33 now says what stage 16 built and that the
  scorecard runs `check:join`. It is no longer Target.
- **5, Entry points:**
  - The `postTodos` example takes its validator as an argument.
  - The **Target (L33).** bullet becomes "What an entry point applies
    is data". It covers `Applies:`, the generated `rules`, and the
    route giving the handler its validator, which `tsc` holds.
- **9, The shape of the code:**
  - The `rules` rows come from the route's validator.
  - The Target bullet that asked for this is gone, because it is
    built. The rest of that Target, keying the index by use case
    (L32), stays.
- **11, Contracts:**
  - "What makes a spec" says `check:join` binds `Assumes` to
    `Applies:` to the validator, and `Given` to a passed test.
  - The **Target (L33).** paragraph becomes **The join (L33).** It
    states:
    - what the join fails on;
    - the report it reads and never writes;
    - the integration test's open status;
    - the BFF's exclusion.
  - The endpoint's parts list includes `Applies:`.
  - The scorecard sentence names `check:rules` and `check:join`.
- **Glossary:** Assumes, Given and Applies are locked, and each names
  what `check:join` fails on.
- **Profile notes:**
  - P62 leaves "not built". It names the files and its exact check,
    and it now cites stages 14 and 16.
  - P60's target is now built.
  - P64's `check:rules` is a step of the required check.

Not changed:
- Chapters 0–4, 6–8, 10, 12 and 13. None of them names `Applies:`, a
  validator's rules, the route's validator or the join.
- Chapter 7's rule table already says the specs cite ids.
