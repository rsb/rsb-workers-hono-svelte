# Handoff 17: keeping the route's type refusals, 2026-11-04

Since handoff 16:
- **Stage 16, `Applies:` and the join, is done on `feat/rules-join`.**
  It has seven commits, `f3b232d`..`a65bd2e`, and is not pushed or
  merged at the time of writing. Its tour is
  `logbook/reports/2026-11-04-16-applies-and-the-join-tour.md`. It built
  the rest of L33:
  - `Applies:` in `prd/todo/api.md`;
  - generated `rules` on each validator;
  - the route giving each handler its validator,
    `route({ postTodos }, { addTodo }, { toNewTodo })`;
  - the state rules' tests named by id;
  - `pnpm check:join`, which is now in the required check with
    `check:rules` (an rl-0009 exception, tour §6).

The next session starts from this file, handoff 16, and the stage 16
tour. Handoff 11's Rules and Environment apply unchanged.

## Standing rules (carried, restated so a fresh context has them)

- Conventional commits, with **no** `Co-Authored-By` or any other
  attribution line. The owner overrides any reminder to add one.
- Never push. Stage by explicit path. Stop before each commit and show
  the stat and the message.
- No `pnpm install` without asking. `pnpm -s` does not work.
- The shell is zsh, which has three traps:
  - there is no `PIPESTATUS`; use `${pipestatus[1]}`;
  - `$var` lists are not word-split, so write paths out;
  - `=====` triggers `=cmd` expansion.
- Never hand-edit a generated file. Today they are:
  - `packages/contract/api/src/{kinds,messages,endpoints,examples}.ts`
    and `apps/api/openapi.json` (`gen:api`);
  - `apps/api/entry-chains.md` (`gen:entry-chains`);
  - `packages/business/src/rules.ts`, `packages/business/rules-index.md`,
    `packages/valid/src/problem.ts`, `packages/valid/src/rules/*`
    (except a `custom` rule's file) and
    `packages/valid/src/todos/{new-todo,todo-patch,todo-filter,completed}.ts`
    (`gen:rules`).
  
  Change the spec or the generator, then regenerate.
- `valid` imports only `business`, and returns problems, not words.
- Don't touch `AGENTS.md` or `.github/workflows/scorecard.yml`
  (rl-0009, L1) without a recorded exception.
- The root dotfiles are untracked sandbox artefacts (`.bash_profile`,
  `.bashrc`, `.gitconfig`, `.gitmodules`, `.idea`, `.mcp.json`,
  `.profile`, `.ripgreprc`, `.vscode`, `.zprofile`, `.zshrc`). Never
  commit or ignore them, and never `git stash -u`.
- Don't read the run branches.
- Every tour ends with a story delta: the chapters changed, or why none
  were.
- The next free decision number is **L36**.

## What stage 17 builds: committed type tests for `route`

Stage 16's tour, §7, says the negative typing is not a regression test.
`apps/api/src/construct.ts` holds `route` and `probe`, and their
overloads are meant to make these fail `tsc`. Stages 13 and 16 checked
each one once, by hand; nothing in the repo keeps them failing.

The refusals:

| # | Call | Why it must not compile | Since |
|---|---|---|---|
| 1 | `route({ postTodos }, { addTodo })` | the handler takes a validator and is given none | 16 |
| 2 | `route({ postTodos }, { addTodo }, { toTodoPatch })` | another validator than the one the handler takes | 16 |
| 3 | `route({ getTodoCounts }, { countTodos }, { toNewTodo })` | a validator for a handler that takes none | 16 |
| 4 | `route({ postTodos }, { listTodos }, { toNewTodo })` | the wrong unit, with the right validator | 16 |
| 5 | a handler whose unit type matches no operation, or more than one (`Runs`) | the handler must take exactly one unit's type | 13 |
| 6 | a `Routes` missing an endpoint, or with a key the contract lacks | `Routes` is a `Record` over `EndpointKey` (P54) | 13 |

**How stage 16 checked 1–4.** It made a scratch copy of `construct.ts`
as `apps/api/src/construct-neg.ts`. The four calls went inside
`constructRoutes`, before its `return`, as
`const neg = [ /* @ts-expect-error … */ route(…), … ]; void neg;`. It
then ran `pnpm exec tsc -p tsconfig.json` in `apps/api`.

A file named `src/neg-probe.ts` held one `@ts-expect-error` on a line
with no error. `tsc` failed on it, which proved the scratch files were
compiled. Both files were then deleted.

A `@ts-expect-error` checks itself: if the line below it compiles, the
directive is unused and `tsc` fails. So a committed file of these lines
is a test that `pnpm check` runs, because `apps/api` checks with
`tsc -p tsconfig.json`, whose `include` is `src`, `test` and
`*.config.ts`.

## Questions to settle with the owner first

Present a plan, then these. Do not edit before the owner answers or
says "you decide".

- **Q1. How the test reaches `route`.** `route`, `probe` and `Runs`
  are private to `construct.ts`. The options:
  - (a) Export them from `construct.ts`.
  - (b) Move them to their own module, for example
    `apps/api/src/route.ts`. `construct.ts` would import them, and so
    would the test.
  - (c) Keep them private and put the `@ts-expect-error` lines in
    `construct.ts` itself.
  
  The catch is that the entry-chain and api-spec readers parse
  `construct.ts` line by line (`tooling/entry-chains/read.ts`,
  `routes.ts`, P55, P58). Option (b) changes the imports those readers
  check. Option (c) puts lines into the file they read, and a
  route-shaped line there could match the reader's pattern.
- **Q2. Where the file lives and what it is called.** One option is
  `apps/api/test/types/routes.ts`. Without `.test.` in the name, vitest
  does not collect it, and `tsc` still compiles it. A `*.test-d.ts`
  file with vitest's typecheck mode is another option, but that is a
  new runner setting.
- **Q3. Which refusals are in scope:** rows 1–4 only, or 5 and 6 too.
  Row 6 needs a `Routes` object built with the wrong keys.
- **Q4. Whether `tooling/` should be type-checked too.** Stage 16's
  tour notes that nothing type-checks `tooling/`; it runs under Node's
  type stripping. That is a separate question, and probably a separate
  stage.

## Next step: stage 17

1. **Read first:**
   - this file;
   - the stage 16 tour, §3 and §7;
   - `apps/api/src/construct.ts` and `apps/api/src/http.ts`;
   - `apps/api/tsconfig.json` and `tsconfig.base.json`;
   - the four handlers that take a validator, in
     `apps/api/src/app/handlers/todos/`: `post-todos`, `patch-todo`,
     `get-todos` and `patch-todos`;
   - `tooling/entry-chains/read.ts` and `routes.ts`, for what they
     require of `construct.ts`;
   - profile notes P54, P55 and P62.
2. **Branch:**
   - If `feat/rules-join` is merged, branch from `main`, for example
     `test/route-types`, after confirming `main` holds `a65bd2e`.
   - If it is not merged, stop and ask the owner whether to stack on
     it.
3. **Plan and questions** (above). Wait for answers.
4. **Commits,** stopping before each. A likely order:
   1. Only if Q1 picks (a) or (b): `refactor(api)`, which moves or
      exports `route` and `probe`, with `check:entry-chains` and
      `check:api` unchanged.
   2. `test(api)`, the type test file. Prove it bites by deleting one
      `@ts-expect-error` line and showing `pnpm check` fails. Then
      break the overload on purpose (for example, loosen the validator
      parameter to `Validator`) and show the directives go unused.
      Revert both before committing.
   3. `docs(logbook)`, covering:
      - the tour, `logbook/reports/2026-11-04-17-…-tour.md`, ending
        with the story delta;
      - P55 and P62's checks, which gain "exact: the type test";
      - chapter 4 or 5 of `logbook/the-api-story.md`, where `route` is
        described;
      - this handoff.
5. **Checks** after the last code commit, each in a fresh command:
   - `pnpm check`, `pnpm check:api`, `pnpm check:entry-chains`,
     `pnpm check:rules`;
   - `pnpm test:tooling`, `pnpm test:unit`, then `pnpm check:join`;
   - `pnpm test:integration`, `pnpm test:e2e`.
   
   After stage 16 the counts were:
   - 155 tooling;
   - `valid` 57, `apps/api` unit 59;
   - 29 integration;
   - 41 e2e.
   
   A type test adds no runner test, so the counts should not move; say
   so if they do.

## Open, carried

From stage 16, all in its tour, §7, and not in this stage:
- The join's unit report is checked for staleness against the test
  files only, not against `packages/operations/src`.
- Whether `check:join` reads the integration report, where
  `todos.cap: the 501st todo is rejected with limit` lives.
- The BFF stays out of the join until it has a spec.
- An `AGENTS.md` pointer to `packages/business/rules-index.md` and
  `gen:rules`, and L35's precedence line, both need an rl-0009
  exception.

Handoffs 11 to 16's other open items carry unchanged.
