# Review tour: slice 4 (Edit), api and BFF, 2026-11-02

Claude wrote this tour of slice 4 for the owner to review against the
code. It was written, not led live. The order is the api story's:
contract → business and valid → operations → data → handlers and
construct. Then the BFF: server, then UI, then the tests.

The code toured is the working tree of `feat/slice-4-edit`, on
`4056a46`, before the slice 4 commit.

Checks on that tree:
- `pnpm check` is clean.
- `test:unit`: 147 tests (fail 6, business 1, contract 18, valid 6,
  operations 8, d1 42, bff 37, api 29). Slice 3 ended at 127.
- `test:integration`: 17, up from 11.
- `test:e2e`: 24, up from 14.

There is no decisions draft for this slice. "Why" cites the step 3
questions of
[handoff 06](../handoffs/2026-11-02-06-slice-3-toggle.md) as Q1–Q8,
and the owner's answers to them:

| Q | Question | Answer |
|---|----------|--------|
| Q1 | Branch name | `feat/slice-4-edit` |
| Q2 | One operation or two | Claude chose one (`updateTodo` with a patch), for the owner to review |
| Q3 | Where the title rule lives | A new package, `packages/valid`: "where shared validation can live across apps" |
| Q4 | The BFF `edit` action | As planned |
| Q5 | Without JS | Editing works with JS only |
| Q6 | Blur saves | Through `requestSubmit`, with a guard against a second save |
| Q7 | 4.1's remove part | Claude chose to check it in slice 5, with no placeholder now |
| Q8 | The lost failure | Fix it |

Each stop lists what was shown, why, and the points raised. "Raised"
means Claude's notes for the review, not agreed or changed. §10
collects them.

## 1. Contract (Q2)

**Shown.** `packages/contract/api/src/todos.ts`:
- `PatchTodoBody` replaces `ToggleTodoBody`.
- It is a `strictObject` with `title` and `completed`, each
  `exactOptional`, piped through a `check` that wants at least one.
- An empty body is a 422 `validation` on `body`, "body must have
  title, completed or both".
- The title's rules are not in the contract. They are checked by the
  handler, as for `AddTodoBody`.

**Why.** The PRD's API table has `{ title?, completed? }`, with at
least one. Q2 made it one body for one operation.

**Raised.**
1. `exactOptional` means a key that is present must have a value:
   `{"title": undefined}` cannot happen in JSON, and `null` is
   refused as "title must be text".

## 2. Business and `@todo/valid` (Q3)

**Shown.**
- `packages/business/src/todos/todo.ts` adds `TodoPatch = { title?;
  completed? }`. Its comment says a title in it was already validated.
- New package `packages/valid` (`@todo/valid`). It depends only on
  business.
- `src/todos/title.ts`: `checkTitle(raw)` trims, then returns
  `ok(trimmed)`, `err("empty")` or `err("too_long")`.
  `TitleProblem` is the union of the two problems.
- Each app turns a `TitleProblem` into its own failure or message.

**Why.** Q3: the owner asked for a package where shared validation
lives across apps. The API and the BFF both had their own copy of the
rule before.

**Raised.**
2. `TITLE_MAX` stays in business, and valid imports it. Either it
   belongs to the rule and moves to valid, or business keeps the
   limits and valid keeps the checks.
3. The title in `TodoPatch` is a plain `string`. As in the slice 2
   tour (§5 item 4), a brand would make "already valid" part of the
   type.

## 3. Operations (Q2)

**Shown.** `packages/operations/src/todos/update-todo.ts`, git-moved
from `toggle-todo.ts`:
- The port is `UpdateStore.updateTodo(id, patch)`. It returns the todo
  as it now is, or `null` when no todo has that id.
- The operation `updateTodo({ dbStore })(id, patch)` wraps a store
  failure as "update todo". A `null` becomes `notFound`.

**Why.** Q2, option A: one operation, one port method and one
statement for both a toggle and a rename. Toggling is now a patch
with only `completed`.

**Raised.**
4. The operation and the store accept an empty patch. The contract
   refuses one, so no caller sends it today. The store would run an
   `UPDATE` that changes nothing and return the row.

## 4. Data, D1 (Q2)

**Shown.** `packages/data/d1/src/todos.ts`:
- **Stmt:** `updateTodoStmt` is
  `UPDATE todos SET title = COALESCE(?2, title), completed =
  COALESCE(?3, completed) WHERE id = ?1 RETURNING id, title,
  completed`.
- **Raw:** `updateTodoRaw`, named "update todo".
- **Outer:** `updateTodo(id, patch)` binds a missing field as `NULL`
  and maps `completed` to 1 or 0.
- It replaces `setCompleted`. The tests and `store.test.ts` were
  renamed.

**Why.** One fixed statement, with no SQL text built from the patch.
Neither column can be `NULL`, so `NULL` only means "not asked to
change".

**Raised.**
5. `COALESCE` works only while every column it patches is
   `NOT NULL`. A nullable field (a due date, for example) could not be
   cleared through it. Then it needs a flag for each field, or a
   statement for each shape.

## 5. API handler and construct (Q2, Q3)

**Shown.**
- `apps/api/src/app/handlers/todos/patch-todo.ts`, `patchTodo(updateTodo)`:
  1. validate the body with `PatchTodoBody`;
  2. copy `completed` into a `TodoPatch`;
  3. check the title, if there is one, with `validateTitle` and use
     the trimmed value;
  4. `updateTodo(id, patch)`, then present.
- `handlers/todos/validate.ts`: `validateTitle` now calls `checkTitle`.
  An empty title is `invalid("title", "title is empty")`. A long one
  is "title is longer than 256 characters".
- `construct.ts`: `updateTodo` replaces `toggleTodo` in `Operations`
  and on `PATCH /todos/:id`.
- `package.json` adds `@todo/valid`.

**Why.** The PRD's API table says "Editing a title to empty" is a 422
from the API. The BFF never sends one (§6), so this protects only
direct callers.

**Raised.**
6. A body with both fields and a bad title is refused whole. The
   toggle in it is not applied. No test pins this.
7. The patch is built with mutation (`patch.completed = …`). The
   handler reads in order, but a builder function may read better.

## 6. BFF server (Q4)

**Shown.**
- `apps/bff/src/lib/server/todos/edit-todo.ts`, `editTodo(api, form)`:

  | Case | Result |
  |------|--------|
  | No `id` in the form | `fail(422)`, "Something went wrong. Try again." |
  | Title empty after trim | `{ edited: id }`, and the API is not asked |
  | Title over 256 | `fail(422)`, "Title must be 1 to 256 characters" |
  | API failure | `fail(status(kind))`, "Something went wrong. Try again." |
  | Success | `{ edited: id }` |

  Every failure carries `{ edit: { id, title, message } }`, so the
  typed text is kept.
- `+page.server.ts` adds the `edit` action.
- `api/todos.ts`: `patchTodo` takes a `PatchTodoBody`. The toggle sends
  `{ completed }` as before.
- `validate-title.ts` (the add form's check) now calls `checkTitle`.
- `package.json` adds `@todo/valid`.

**Why.**
- Q4, as planned. The empty case is deviation 19.
- The BFF writes every message from the kind (deviation 16). The
  API's "title is empty" is never shown.

**Raised.**
8. The add action checks through `validate-title.ts`. The edit action
   calls `checkTitle` directly, because it treats empty and too long
   differently. That is two ways to read the same rule in one
   folder. Handoff 06 already carries renaming `validate-title.ts`.
9. `text()` (a form value as a string) is now copied in
   `toggle-todo.ts` and `edit-todo.ts`.

## 7. BFF UI (Q5, Q6, Q8)

### 7a. Each form keeps its own failure (Q8)

**Shown.**
- `NewTodo.svelte`:
  - `title` and `error` are still `$derived` from the `failed` prop,
    which now only matters without JS.
  - With JS, the `add` SubmitFunction sets them from its own result
    on a failure and does not call `update()`. So `form` is left
    alone.
  - On success it calls `update()` and clears both.
- `TodoItem.svelte`, toggle (lines 21–55):
  - `toggleError = $derived(error)` is the row's own failure. It is
    cleared when a toggle starts.
  - On a failure the row sets its message and calls `invalidateAll()`
    instead of `update()`, so the list reloads and `form` is left
    alone.
- `+page.svelte` and `TodoList.svelte`: comments only.

**Why.** Q8. Before, a toggle after a failed add replaced `form`, and
the add lost its text. With JS, `form` now only ever holds successes.
Without JS, each post is a full page load, so failures still arrive
through `form`.

**Raised.**
10. The pattern is the same in three places: a writable `$derived`
    seeded from a no-JS prop, then set by its own SubmitFunction. It
    is a candidate for profile-notes.

### 7b. The title and editing (Q5, Q6)

**Shown.** `TodoItem.svelte`, lines 57–170 and 191–224:
- **The title** is `<button type="button" class="title">` holding
  `<span id="todo-title-…">` and the hidden ", press Enter to edit".
  A double-click edits. A click with `detail === 0` (Enter or Space)
  edits. A mouse click does nothing.
- **Editing** is a `?/edit` form with a hidden `id`, the hidden label
  "Edit to-do", the `.edit` input, and `.field-error` with
  `aria-live`. The input is focused by an attachment (`{@attach}`),
  not `bind:this`.
- **Keys:**
  - Enter submits the form natively.
  - Escape sets `closing` and stops editing.
  - Both send focus back to the title button, through
    `focusTitleIfAsked`.
- **Blur** calls `form.requestSubmit()` unless `closing` is set.
- **The `edit` SubmitFunction:**
  - It sets `closing` first, so the blur that follows a submit does
    nothing.
  - If `draft.trim()` equals the saved title, it cancels the request
    and stops editing.
  - A failure keeps the input open with the returned text and
    message, and clears `closing`.
  - Success runs `update({ reset: false })`, then stops editing.
- **Typing** clears the message.
- **The check** is labelled by the title span. While editing, that
  span is gone, so the check takes `aria-label={todo.title}`.
- **CSS:** `.title` is a reset button. `.edit-form`, `.edit` and
  `.field-error` use the design's values.
- The Svelte autofixer is clean.

**Why.**
- Q5: editing works with JS only.
- Q6: blur saves through `requestSubmit`, so it goes through the same
  action and SubmitFunction as Enter. `closing` stops a double save.
  An unchanged title sends no request.
- The markup is the design's (handoff 06, "Design, for slice 4").

**Raised.**
11. **Decision for the owner.** Chromium names the title button
    "buy milk , press Enter to edit", with a space before the comma,
    because the title and the hint are separate spans. The edit tests
    match on the title alone. Putting the hint in the title's span
    removes the space, but the check is labelled by that span and
    would read the hint too. That would need another way to label the
    check.
12. Without JS, the title button does nothing and there is no way to
    edit. The page does not say so.
13. After a failed save, `closing` is cleared, so leaving the input
    saves the same text again and gets the same 422. It is harmless
    but sends a request.
14. The client trims to compare with the saved title. That is a
    second copy of part of the rule, though only for skipping a
    request.
15. `returnFocus` is worked out from `document.activeElement.id`. A
    blur save does not return focus. Enter and Escape do.

## 8. Tests

**Shown.**
- **Unit:**
  - valid: 6 for `checkTitle`.
  - contract: `PatchTodoBody` (neither field, each field alone, both,
    an unknown key, and each field of the wrong type).
  - operations: renamed to `update-todo.test.ts` and rewritten.
  - d1: `updateTodo` binds in placeholder order, binds `NULL` for a
    missing field, reads the returned row, reports no todo when no row
    comes back, and passes a D1 failure up.
  - api: `patch-todo.test.ts` adds the empty body, empty title, too
    long, trimmed and both fields. The `construct.test.ts` fake's
    `updateTodo` spreads the patch.
  - bff: `edit-todo.test.ts`, 6: the §6 table, with the API failure
    as a 404 and as a 500, and success sending the title trimmed.
- **Integration:** `apps/api/test/integration/todos-edit.test.ts`, 6:
  - rename, trimmed, keeping `completed`;
  - toggle, keeping the title;
  - both fields;
  - empty title refused, old title kept;
  - 257 refused;
  - `not_found`.
- **E2e:** `apps/bff/e2e/edit.test.ts` has 4.1–4.9, plus "a failed
  add keeps its text and message when a todo is toggled" (Q8).
  - Titles are unique (a random suffix), because the database is
    shared and has no remove.
  - `open(page)` waits for `networkidle` after `goto`.
- **E2e, slice 2:** `add-and-list.test.ts` now checks the check's
  accessible name, not the row's text. The row's text includes the
  hidden hint.

**Why.**
- Without the wait, the tests acted before hydration. The add was a
  full page post, and double-click or Enter did nothing.
- The title button's name has the hint and the space (item 11), so
  the slice 2 tests read the check instead.

**Raised.**
16. Playwright discourages `networkidle`. A hydration marker (an
    attribute set in `onMount`, for example) would be a sharper wait,
    but it is app code that exists only for the tests.
17. The shared e2e database grows by about ten todos a run. With the
    500 limit and no remove, it fills after enough local runs
    without a reset.
18. Nothing tests a combined toggle and rename through the BFF. The
    BFF never sends one.

## 9. Not done in this slice

- 4.1's "remove is hidden while editing" waits for slice 5 (Q7). A
  comment at the top of `edit.test.ts` says so.
- No findings file, and no profile-notes entries. Stage 06's
  close-out is still paused (handoff 06, "Open, carried").
- Not checked by eye in light and dark.

## 10. Open for the owner

### Decisions
1. Review Q2: one `updateTodo` with a patch and one `COALESCE`
   statement (§3, §4).
2. The title button's name and the space (item 11).

### Smaller choices, kept unless the owner objects
3. `TITLE_MAX` in business, or in valid (item 2).
4. The empty patch below the contract (item 4).
5. `COALESCE` and `NOT NULL` columns (item 5).
6. A bad title refuses a toggle in the same body (item 6).
7. Two ways to read the title rule in the BFF, and the copied `text()`
   (items 8 and 9).
8. No-JS editing says nothing (item 12).
9. Re-save after a failed save, on blur (item 13).
10. `networkidle` vs a hydration marker (item 16).

### Candidates for profile-notes
11. Each form keeps its own failure: a writable `$derived` seeded from
    a no-JS prop (item 10).
12. `requestSubmit` on blur with a `closing` guard, for one save from
    Enter and blur (§7b).

### Housekeeping before the slice 4 commit
13. Handoff 06 is untracked and goes in the slice 4 commit, with
    `packages/valid/` and this report.
14. `pnpm-lock.yaml` changed with the owner's install for
    `@todo/valid`.
15. The e2e database fills over time (item 17).
