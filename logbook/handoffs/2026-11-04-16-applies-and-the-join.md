# Handoff 16: `Applies:`, the validator's rules and the join, 2026-11-04

Since handoff 14:
- **Stage 14, the story catch-up, is merged** (PR #35). Its tour is
  `logbook/reports/2026-11-04-14-story-catch-up-tour.md`. It recorded
  L29–L35 and rewrote the seven use cases in L30's form.
- **Stage 15, the rules spec, is merged** (PR #36, `da116a6`). Its tour
  is `logbook/reports/2026-11-04-15-rules-spec-tour.md`. It built L34
  and the first part of L33:
  - `prd/todo/rules.md`: 2 constants, 4 inputs and 6 rules
    (`title.length`, `patch.nonempty`, `todos.cap`, `todo.exists`,
    `todos.order`, `todos.unique_id`).
  - `tooling/rules/`, run as `pnpm gen:rules` and `pnpm check:rules`.
    It generates `packages/business/src/rules.ts`, `valid`'s
    `problem.ts`, `rules/` and four validators, and
    `packages/business/rules-index.md`. It also lints the use cases'
    citations: every id exists and sits in the section for its kind.
  - Problems are `{ field?, rule, violation, …params }`, renamed by hand
    first, then regenerated with `valid`'s 53 tests unchanged.

There is no handoff 15: handoff 14's outline and the owner's decisions
on the first review of `rules.md` stood in for one. This handoff is
numbered for the stage it plans.

The next session starts from this file, handoffs 14 to 00, and the
reports. Handoff 11's Rules and Environment apply unchanged.

## Standing rules (carried, restated so a fresh context has them)

- Conventional commits, with **no** `Co-Authored-By` or any other
  attribution line. The owner overrides any reminder to add one.
- Never push. Stage by explicit path. Stop before each commit and show
  the stat and the message.
- No `pnpm install` without asking. `pnpm -s` does not work.
- The shell is zsh: no `PIPESTATUS`, and `$var` lists are not
  word-split, so write paths out.
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
  (rl-0009, L1).
- The root dotfiles are untracked sandbox artefacts (`.bash_profile`,
  `.bashrc`, `.gitconfig`, `.gitmodules`, `.idea`, `.mcp.json`,
  `.profile`, `.ripgreprc`, `.vscode`, `.zprofile`, `.zshrc`). Never
  commit or ignore them, and never `git stash -u`.
- Don't read the run branches.
- Every tour ends with a story delta: the chapters changed, or why none
  were.
- The next free decision number is **L36**.

## What stage 16 builds: the rest of L33

L33: specs cite rules by id only, and the code carries what it applies
as data. Stage 15 did the id rename and the citation lint. Still
**Target**, per the story's opening and P62 in `logbook/profile-notes.md`:

1. **`Applies:` in `prd/todo/api.md`.** Each endpoint lists the input
   rules its entry point applies, by id, beside `Serves:`. Today:
   - `POST /todos` (`toNewTodo`): `title.length`.
   - `PATCH /todos/{id}` (`toTodoPatch`): `patch.nonempty`,
     `title.length`.
   - `GET /todos` (`toTodoFilter`) and `PATCH /todos` (`toCompleted`):
     none. Their validators decode but apply no rule.
   - `GET /todos/counts`, `DELETE /todos`, `DELETE /todos/{id}`: no
     validator.
   - `GET /health` is a probe and serves no use case.
   
   `tooling/api-spec/parse.ts` has to accept the line, and `check:api`
   must still pass with the contract unchanged.
2. **A validator exports the rules it applies** (`toNewTodo.rules`).
   `tooling/rules/emit.ts` already knows each input's field rules and
   input rules, so this is generated. Order: input rules first, then
   field rules in field order, matching how the validator runs them.
3. **The route declares its validator.** Today a handler imports and
   calls its validator inside itself (for example
   `apps/api/src/app/handlers/todos/post-todos.ts:19`), and
   `route({ postTodos }, { addTodo })` in `apps/api/src/construct.ts`
   names only the handler and the unit. The target is
   `route({ postTodos }, { addTodo }, { toNewTodo })`. Two tools read
   `construct.ts` and must follow the change:
   - `tooling/api-spec` (`readRoutes`, for `check:api`);
   - `tooling/entry-chains` (for `check:entry-chains` and the index).
4. **The join check**, which fails unless:
   - for each endpoint serving a use case, `Applies` includes every
     id in that use case's `Assumes`;
   - the route's validator's `rules` equal the endpoint's `Applies`;
   - every cited id exists (`check:rules` does this already);
   - each `Given` id has a named test, read from the test runner's
     report. The `Given` ids today are `todos.cap` (`add-a-todo`) and
     `todo.exists` (`change-a-todo`, `remove-a-todo`).
5. **Named tests per `Given` id.** The behaviour is already tested in
   `packages/operations/test/unit/todos/`:
   - `add-todo.test.ts:30` "names a limit failure when the store did
     not insert";
   - `update-todo.test.ts:30` and `delete-todo.test.ts:28`, the
     `not_found` cases.
   
   None names its rule id yet.

## Questions to settle with the owner first

Present a plan, then these. Do not edit before the owner answers or
says "you decide".

- **Q1. Where the join lives.** A fourth tool (`tooling/join/`, with
  `pnpm check:join`), or an extension of `check:rules`, which already
  reads the rules and the use cases. The join also needs `api.md` and
  `construct.ts`, which belong to the other two tools.
- **Q2. How the route carries its validator.** Either the handler takes
  the validator as an argument, which changes every handler's builder
  and its tests, or the route records the validator's name as data
  while the handler keeps calling it, plus a check that the two agree.
  The first makes the declaration true by construction; the second is
  smaller.
- **Q3. How a test names its rule.** A test name containing the id
  (`it("todos.cap: names a limit failure…")`), a `describe` per id, or
  a tag. Also which runner's report is read. These are vitest unit
  tests, and `todos.cap` is kept atomic by the D1 store, so it may
  want an integration test named too.
- **Q4. Validators that apply no rule.** Should `GET /todos`,
  `PATCH /todos`, `GET /todos/counts` and the deletes write
  `Applies: none`, and should `route(…)` take a validator for them at
  all?
- **Q5. The BFF.** Its form actions call the same validators
  (`apps/bff/src/lib/server/todos/*.ts`). Is the BFF in the join this
  stage, or does it stay api-only until the BFF has a spec of its own?
- **Q6. The CI step.** Running the join (and `check:rules`) as steps of
  the required check means editing `scorecard.yml`, which needs a
  recorded rl-0009 exception. Today drift still fails CI, because
  `test:tooling` runs `--check` through each tool's `generate.test.ts`.
  The join can be covered the same way until the owner records the
  exception.

## Next step: stage 16

1. **Read first:** this file; the stage 15 tour; `prd/todo/rules.md`;
   `prd/todo/api.md`; `apps/api/src/construct.ts`; `tooling/rules/`,
   `tooling/api-spec/` and `tooling/entry-chains/`; the seven use
   cases; story chapters 5, 9 and 11; P62.
2. **Branch:** create one from `main` (for example `feat/rules-join`).
   First confirm that `main` holds `da116a6`; if it doesn't, stop and
   tell the owner.
3. **Plan and questions** (above). Wait for answers.
4. **Commits,** stopping before each. A likely order:
   1. `Applies:` in `api.md` and its parser;
   2. the generated `rules` on each validator;
   3. the route's validator and the two readers that follow it;
   4. the named tests;
   5. the join check and its tests;
   6. `docs(logbook)`: the story, the glossary, profile notes and the
      tour (`logbook/reports/2026-11-04-16-…-tour.md`), ending with the
      story delta. L33 and P62 leave Target for what was built.
5. **Checks** after the last code commit, each in a fresh command:
   - `pnpm check`, `pnpm check:api`, `pnpm check:entry-chains` and
     `pnpm check:rules`, plus the join;
   - `pnpm test:tooling`, `pnpm test:unit`, `pnpm test:integration`
     and `pnpm test:e2e`.
   
   After stage 15 the counts were: 123 tooling, `valid` 53, 29
   integration, 41 e2e. Report the new counts and say why they changed.

## Open, carried

Handoffs 11 to 14's open items carry. From stage 15:
- **An rl-0009 exception, for the owner:** `check:rules` (and the join)
  as steps of the required check in `scorecard.yml`. Also an
  `AGENTS.md` pointer to `packages/business/rules-index.md` and
  `gen:rules`, alongside L35's precedence line and stage 13's index
  pointer.
- **Deferred:** whether `api.md` keeps its own shapes or cites the
  rules spec's inputs (`Body: NewTodo`).
- **A later change:** `setAllCompleted` taking `{ completed }`.
- **Kept as written:** `api.md`'s "at least 1 field" on
  `PATCH /todos/{id}` is stage 11 Q2's redundancy on the wire, not
  drift.
- **Not modelled yet:** auth as subsystems, and branded input types
  (from handoff 14).
