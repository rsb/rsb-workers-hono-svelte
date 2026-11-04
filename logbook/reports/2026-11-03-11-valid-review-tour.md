# Review tour: stage 11 (`valid` as a deep module), 2026-11-03

Claude wrote this tour of stage 11 for the owner to review against the
code. It was written, not led live. The order is the build order:
`valid`, then the api, then the BFF, then the checks and the docs.

The code toured is the working tree of `feat/valid-deep-module`, made
from `main` at `ca0bfff` (which contains `91da023` and the merged
`feat/tooling-api-spec`, PR #32), before the stage 11 commits. The
change is 35 files of code and tests: 13 new, 16 changed, 6 deleted
(staged by `git rm`). The docs are 3 changed files and this report.
That does not count handoff 11.

Checks on that tree, each tier in a fresh command:
- `pnpm check` is clean. `pnpm check:api` exits 0: the spec, the
  contract and `openapi.json` are unchanged.
- `test:unit`: 327 tests (fail 6, business 1, contract 57, valid 53,
  operations 20, d1 61, bff 70, api 59). Slice 8 ended at 247; the
  tooling stage brought contract from 36 to 57. Stage 11's own change:
  valid 6 → 53, api 57 → 59, bff 60 → 70.
- `test:integration`: 29, unchanged.
- `test:e2e`: 41, unchanged. No e2e test changed.

"Why" cites the questions of
[handoff 11](../handoffs/2026-11-03-11-valid-and-cli.md) as Q1–Q6 and
the owner's answers, given with three changes to the plan:

| Q | Owner's answer |
|---|----------------|
| Q1 | Verbs: `toNewTodo`, `toTodoPatch`, `toTodoFilter` |
| Q2 | Keep `unknown` candidates, with the comment at the top of `fields/` |
| Q3 | Return all problems; the api shows the first, the BFF one per form |
| Q4 | No `"on"`. When a delivery needs a spelling, it is added in `fields/`, never in the delivery |
| Q5 | Decode problems are generic, named by the type expected (`not_text`, `not_boolean`), with the field beside them; check problems are named after the rule they guard (`title.empty`, `title.too_long`, `patch.empty`). Written into the glossary; the check ids are fixed from here |
| Q6 | L27 for `valid`, L28 for the CLI |
| Change 1 | No grep-check exception: both message tables word `title.too_long` from `problem.max`, not from `TITLE_MAX`. Business constants appear only in business and `valid` |
| Change 2 | Don't defer `setAllCompleted`: `todos/completed.ts`, used by `PATCH /todos` and the BFF's `markAll`; the BFF's own `"true"`/`"false"` check goes |
| Change 3 | Title tests include the UTF-16 rule: 255 characters and one astral-plane emoji is 257 code units and fails; 256 code units passes |

After a first review the owner decided six more things (§7):

| # | Owner's decision |
|---|------------------|
| D1 | Scope the constants check to deliveries: business constants appear only in business, `valid` and operations (the enforcers), never under `apps/` |
| D2 | Both title problems carry the title rule's parameters: `title.empty` gains `max`. A problem carries its rule's parameters, not only the ones the violation touched; empty and too long are two violations of one rule. The BFF words the title rule from the problem in both cases; the e2e words stay |
| D3 | The two messages the BFF shows with no problem in hand lose their numbers: the api's validation failure on a title the BFF accepted is skew or a bug, so it shows the generic message; `LIST_FULL` becomes "The list is full. Clear completed or remove some to add more." Failures carrying their parameters is a profile-notes candidate, not this stage |
| D4 | Rule ids outside `valid`: constants only. The ids are the shared vocabulary between `valid` and the deliveries |
| D5 | The behaviour change for forms the page never sends stands: a missing field is a usage problem, not an empty title |
| D6 | No collector, and `body` for `patch.empty`: fine |

## 1. `packages/valid`

```
packages/valid/src/
├─ problem.ts          Problem, Field, Problems
├─ fields/             private: not in the exports map
│  ├─ decode.ts        text, flag; the Q2 comment at the top
│  └─ title.ts         title: decode, trim, 1 to TITLE_MAX
└─ todos/
   ├─ new-todo.ts      NewTodoCandidate, toNewTodo
   ├─ todo-patch.ts    TodoPatchCandidate, toTodoPatch
   ├─ todo-filter.ts   TodoFilterCandidate, toTodoFilter
   └─ completed.ts     CompletedCandidate, toCompleted
```

- **`problem.ts`.** `Problem` is a union of five:
  `{ field, rule: "not_text" }`, `{ field, rule: "not_boolean" }`,
  `{ field: "title", rule: "title.empty", max }` (D2),
  `{ field: "title", rule: "title.too_long", max }` and
  `{ rule: "patch.empty" }`. `Field` is `"title" | "completed"`.
  `Problems` is `[Problem, ...Problem[]]`, so a failure always has a
  first problem and `const [problem] = result.error` needs no check.
- **`patch.empty` has no field.** It is about the whole candidate, and
  `body` is an HTTP word. The api's table names the field `body`, so
  the reply still matches the spec.
- **`fields/`.** `decode.ts` holds `text(field, value)` and
  `flag(field, value)`. `flag` takes `true`, `false`, `"true"` and
  `"false"`, and nothing else: `"on"`, `"TRUE"` and `""` are
  `not_boolean` (Q4). `title.ts` runs the title rules in order (not
  text, then trim, then empty, then too long), so a title has at most
  one problem.
- **Inputs.** Each `to<Input>` returns `Result<Input, Problems>`.
  - `toNewTodo({ title })`.
  - `toTodoPatch({ title?, completed? })`: `undefined` means not
    given. Neither given is `patch.empty`, alone. Otherwise every field
    is checked and every problem returned, title first.
  - `toTodoFilter({ completed? })`: missing keeps every todo.
  - `toCompleted({ completed })` (change 2): the bare boolean
    `setAllCompleted` takes.
- **Privacy.** `exports` is now `./problem.ts` and `./todos/*`. Claude
  checked that an import of `@todo/valid/fields/decode.ts` from the api
  fails `tsc` with TS2307, then removed the probe file.
- **The package description** now says what the module is: "How a
  candidate becomes a business input: decode, check, build. Returns
  problems, never words. Imports business only."
- **Deleted:** `todos/title.ts` (`checkTitle`) and its test.

**Differences from the plan, Claude's:**
- There is no `fields/problems.ts` collector. A title has at most one
  problem, and only `toTodoPatch` gathers more than one, so it collects
  them in a local array. A collector earns a file when a second input
  needs one.
- The title rule is `fields/title.ts`, not a `todos/` file, so it stays
  private and is shared by `toNewTodo` and `toTodoPatch`.
- There is no `fields/id.ts` (as planned: ids have no rule yet).

## 2. The api

- **`handlers/messages.ts`** (new): `invalidOf(problems)` gives the
  first problem as `Fail<"invalid">`. `message(problem)` is a `switch`
  over the rule ending in a `never` check:

  | Rule | Field | Words |
  |---|---|---|
  | `not_text` | the problem's | `${field} must be text` |
  | `not_boolean` | the problem's | `${field} must be true or false` |
  | `title.empty` | `title` | `title is empty` |
  | `title.too_long` | `title` | `title is longer than ${max} characters` |
  | `patch.empty` | `body` | `body must have title, completed or both` |

  `TITLE_MAX` is not imported (change 1). `title.empty` carries `max`
  (D2) but the api's words for it do not use it. `not_text` cannot be reached
  over HTTP today, since the contract refuses a non-string title
  first; it has words so the table is complete.
- **Handlers.** Each calls `valid` after its envelope step:
  - `post-todos.ts`: `toNewTodo({ title: body.value.title })`;
  - `patch-todo.ts`: `toTodoPatch({ title, completed })`. The
    hand-built patch and the conditional title check are gone;
  - `get-todos.ts`: `toTodoFilter({ completed: query.value.completed })`
    replaces the local `toFilter`;
  - `patch-todos.ts`: `toCompleted({ completed })` (change 2).
- **Deleted:** `handlers/todos/validate.ts` and its test (5 tests).
  `handlers/todos/` no longer has a `validate.ts`.
- **Tests.** `messages.test.ts` (7) words each rule as the spec does,
  words `max` from the problem, and shows the first problem only. The
  handler tests keep their expected messages unchanged.
  `post-todos.test.ts` uses `"x".repeat(257)` in place of
  `TITLE_MAX + 1`, as `patch-todo.test.ts` already did.

## 3. The BFF

- **`messages.ts`.** `problemMessage(problem)` is the BFF's table, a
  `switch` with a `never` check:
  - `title.empty` and `title.too_long` → `Title must be 1 to
    ${problem.max} characters` (change 1, D2). There is no `TITLE_RULE`
    constant any more, and the file imports nothing from business;
  - `not_text`, `not_boolean`, `patch.empty` → `SOMETHING_WENT_WRONG`:
    the page never sends them, and the person cannot fix them.
- **Actions.** Each fills a candidate from `FormData` in one line and
  shows the first problem (Q3):
  - `add-todo.ts`: `toNewTodo({ title: form.get("title") })`. It still
    keeps the typed text, so a failure gives it back to the input;
  - `edit-todo.ts`: `toTodoPatch({ title: form.get("title") })`;
    `title.empty` is still a success that does not ask the api
    (deviation 19);
  - `toggle-todo.ts`: `toTodoPatch({ completed: form.get("completed") })`.
    The id check stays in the action;
  - `mark-all-todos.ts`: `toCompleted({ completed: form.get("completed") })`
    (change 2). The action's own `"true"`/`"false"` check is gone.
- **`addFailedMessage`** (D3): `limit` → `LIST_FULL`, now "The list is
  full. Clear completed or remove some to add more."; every other kind,
  `validation` included, → `SOMETHING_WENT_WRONG`.
- **Deleted:** `validate-title.ts` and its test (3 tests).
- **No `.svelte` file changed**, so the autofixer was not needed.

**Behaviour changes for forms the page never sends** (Claude's,
kept by the owner, D5). They refine deviation 19: an empty title in an
edit is still a success with no api call, but a missing title field is
a usage problem, not an empty title.
- An add form with no `title` field used to read as `""`, which is
  empty, and showed `TITLE_RULE`. It is now `not_text`, and shows
  "Something went wrong. Try again."
- An edit form with no `title` field used to read as `""`, which is a
  success with no api call. It is now `not_text`, a 422 with "Something
  went wrong. Try again.", as a missing id already was.

Both have new unit tests ("says something went wrong, without asking
the API, when the form has no title" in `add-todo.test.ts`, and the
missing-title case in `edit-todo.test.ts`), and so does toggle with no
`completed` in `toggle-todo.test.ts`.

## 4. Checks

`package.json`:
- `@todo/valid` lists only `@todo/business`. Pass.
- `@todo/operations` and `@todo/data-d1` do not list `@todo/valid`, and
  nothing under `packages/operations` or `packages/data` imports it.
  Pass.

Grep-checks:
- No `Context`, `FormData`, `argv` or `hono` in `packages/business/src`
  or `packages/valid/src`. Pass.
- `packages/valid` imports neither `@todo/fail` nor a contract. Pass.
- Business constants only in `packages/business`, `packages/valid`
  and `packages/operations`, never under `apps/` (D1). Pass:
  `git grep "TITLE_MAX\|TODO_LIMIT" -- apps` finds nothing.

The handoff's version of the last check also named rule ids. The owner
kept it to constants (D4): rule ids are the vocabulary `valid` shares
with the deliveries, so a message table may `switch` on them and
`edit-todo.ts` may test for `title.empty`.

## 5. Docs

- **Story.** L27 added to the decision list. Chapter 0: `valid` in
  both trees and a row in the move table. Chapter 5: the three-step
  validate duty (decode the envelope, `valid`, word the problem);
  `postTodos` in the template uses `toNewTodo` and `invalidOf`; the
  paragraph on `handlers/todos/validate.ts` replaced; two rows added to
  A8's table. Chapter 7: a new section, "Business and `valid`", with
  the boundary, why `valid` is not folded into business, the table of
  inputs, decode, check and build, problems and the two kinds of rule
  id. Chapter 9: `valid`'s edges, privacy through `exports` (the old
  Open item, now answered), the grep-checks, and the entry-chain
  index's `rules` row now names `toTodoPatch`. Chapter 13: a message
  is written by the delivery that shows it. Chapter 12 is unchanged
  until stage 12, as the handoff says.
- **Glossary.** L1–L27 in the intro. A new section, Validation:
  Delivery, Candidate, Decode, Check, Build, Problem and Rule id, each
  *locked*. Validate once (now L12, L27) gains the three steps and
  links Check; Anti-corruption layer links Decode. Rule id records the
  two kinds and that check ids are fixed (Q5).
- **Profile notes.** P47–P53: the `valid` pattern, privacy through
  `exports`, the `package.json` rule, the grep-checks (D1), the
  compiler-checked message tables, a problem carrying all its rule's
  parameters (D2), and failures carrying theirs (D3, not built).

## 6. Open for the owner

Nothing. The first review's three open items (the constants check,
`patch.empty`'s field, the forged-form changes) are settled by D1–D6.

### Smaller choices, kept unless the owner objects

- `invalidOf` and `problemMessage` as the table names; `Problems` as
  the non-empty tuple.
- `fields/decode.ts` holds both decoders, so the Q2 comment sits at the
  top of one file.
- `toCompleted` returns a bare `boolean`, not `{ completed }`.

### Housekeeping

- The index holds the six deletions from `git rm`. Nothing else is
  staged. The dotfiles at the root are untouched.
- Two commits: one for the code, and one `docs(logbook)` for the
  story, glossary, profile notes, this tour and handoff 11.

## 7. After the first review (D1–D6)

- **`valid`.** `title.empty` carries `max: TITLE_MAX` (D2). The `valid`
  tests and the api's `messages.test.ts` expect it.
- **BFF `messages.ts`.** Imports nothing from business. Both title
  problems are worded from `problem.max`; `TITLE_RULE` is gone, and
  its tests compare against the literal "Title must be 1 to 256
  characters", which the e2e tests still see. `LIST_FULL` has no
  number; `addFailedMessage("validation")` is the generic message
  (D3). New tests: `problemMessage` words both title problems from a
  `max` of 10; `addFailedMessage` for `limit`, `validation` and
  `internal`; `addTodo` shows the generic message, keeping what was
  typed, when the api refuses a title the BFF accepted.
- **`apps/api/test/unit/construct.test.ts`** no longer imports
  `TODO_LIMIT`: it fills the list to a literal 500, since D1 keeps
  business constants out of `apps/`, tests included. That reading of
  "never under `apps/`" is Claude's.
- **Docs.** Story: L27 states the scope of the constants and that a
  problem carries all its rule's parameters; chapter 7's paragraph on
  parameters; chapter 9's check, now passing; chapter 13 on messages
  with no problem in hand. Glossary: Problem. Profile notes: P50
  rescoped, P52 and P53 added.
- **Tiers** after D2 and D3, each in a fresh command: `pnpm check`
  clean, `pnpm check:api` exit 0, `test:unit` 327, `test:integration`
  29, `test:e2e` 41.

