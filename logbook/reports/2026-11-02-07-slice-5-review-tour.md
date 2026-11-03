# Review tour: slice 5 (Delete), api and BFF, 2026-11-02

Claude wrote this tour of slice 5 for the owner to review against the
code. It was written, not led live. The order is the api story's:
contract → operations → data → handlers and construct. Then the BFF:
server, then UI, then the tests.

The code toured is the working tree of `feat/slice-5-delete`, on
`bc2adf3`, before the slice 5 commit. The change is 15 files changed
and 9 new, not counting handoff 07 and this report.

Checks on that tree:
- `pnpm check` is clean.
- `test:unit`: 165 tests (fail 6, business 1, contract 20, valid 6,
  operations 11, d1 46, bff 42, api 33). Slice 4 ended at 147.
- `test:integration`: 19, up from 17.
- `test:e2e`: 26, up from 24.

There is no decisions draft for this slice. "Why" cites the step 3
questions of
[handoff 07](../handoffs/2026-11-02-07-slice-4-edit.md) as Q1–Q11, and
the answers to them. The owner answered Q1 and Q2, and asked Claude to
answer the rest: "you answer the rest and I will review". Q3–Q11 are
Claude's, for the owner to review.

| Q | Question | Answer |
|---|----------|--------|
| Q1 | Branch name | `feat/slice-5-delete` (owner) |
| Q2 | Naming | Owner: "ui can say remove but handlers can or operations can say delete api does not have to match the ui both things can be true" |
| Q3 | The reply | A new `DeletedReply = { id }` |
| Q4 | The store fact | `deleteTodo(id)` reports whether a row was deleted; the operation turns "none" into `notFound` |
| Q5 | Removing a todo already gone | The BFF counts a 404 as removed |
| Q6 | Without JS | A plain `?/remove` form post |
| Q7 | With JS, when the row goes | When the reply comes; it does not go at once |
| Q8 | A failed remove | The row shows its own message, apart from a toggle's |
| Q9 | Focus after a remove | The next row's title, else the previous row's, else the new-todo input |
| Q10 | Visibility | Opacity 0; 1 on hover or focus within the row, and always under `(hover: none)`; not rendered while editing |
| Q11 | Scenario 5.2's "only" | The delete tests first remove every todo through the page |

Each stop lists what was shown, why, and the points raised. "Raised"
means Claude's notes for the review, not agreed or changed. §10
collects them.

## 1. Contract (Q3)

**Shown.** `packages/contract/api/src/todos.ts` adds
`DeletedReply = v.strictObject({ id: v.string() })`, exported from
`index.ts`. `DELETE /todos/:id` has no body, so there is no body schema.

**Why.** The PRD's API table says `DELETE /todos/:id` answers 200
`{ id }`.

**Raised.**
1. The reply only repeats the id from the path. Nothing reads it
   today: the BFF names the removed todo from its own form. It is kept
   because the PRD's table says `{ id }`.

## 2. Operations (Q2, Q4)

**Shown.** New `packages/operations/src/todos/delete-todo.ts`:
- The port is `DeleteStore.deleteTodo(id)`. It answers whether a todo
  was deleted.
- The operation `deleteTodo({ dbStore })(id)` wraps a store failure as
  "delete todo". `false` becomes `notFound("no todo has id …")`.
  Success returns the id.

**Why.**
- Q2: the operation says delete.
- Q4: the store reports a fact and the operation decides what it
  means, as `updateTodo` does with `null`.

**Raised.**
2. The operation returns the id it was given, not one read back from
   the store. With a boolean fact there is nothing to read back.

## 3. Data, D1 (Q4)

**Shown.** `packages/data/d1/src/todos.ts`:
- **Stmt:** `deleteTodoStmt` is `DELETE FROM todos WHERE id = ?1`.
- **Raw:** `deleteTodoRaw` runs it through `execute`, named "delete
  todo", and gives the number of rows changed.
- **Outer:** `deleteTodo(id)` reports `changes === 1`. The id is the
  primary key, so it is one row or none.
- `store.test.ts` lists `deleteTodo` among the store's methods.

**Why.** Counting changed rows is how `addTodoUnlessFull` already
reports its fact. No row needs reading back.

**Raised.**
3. Handoff 07 suggested `DELETE … RETURNING id`. Claude used the
   change count instead, as above. Either gives the same fact.

## 4. API handler and construct (Q2)

**Shown.**
- New `apps/api/src/app/handlers/todos/delete-todo.ts`,
  `deleteTodo(deleteTodo)`:
  1. read `:id`;
  2. run the operation;
  3. on a failure, `mapFailure` (404 `not_found`, 500 `internal`);
  4. on success, `success(c, { id })`.
- `apps/api/src/http.ts`: `Route.method` adds `"DELETE"`.
- `construct.ts`:
  - `Operations` gains `deleteTodo`, built with the shared `dbStore`.
  - The route table adds `DELETE /todos/:id`.
  - The handler is imported as `deleteTodoHandler`.

**Why.** Handlers are named by their HTTP method (`getTodos`,
`postTodos`, `patchTodo`). For delete, the method and the operation
have the same name.

**Raised.**
4. **The name clash.** `construct.ts` imports both an operation and a
   handler called `deleteTodo`, so one needs an alias. Inside
   `delete-todo.ts`, the parameter `deleteTodo` shadows the export of
   the same name. `patch-todo.ts` has the same pattern (`updateTodo` in
   `patchTodo`), but there the names differ. Other ways out: a suffix
   on all handlers, or another name for the operation.
5. The 8 KiB body limit runs before any route. A `DELETE` with a body
   is not read, and no test sends one.

## 5. BFF server (Q2, Q5)

**Shown.**
- `apps/bff/src/lib/server/api/todos.ts` adds `deleteTodo(api, id)`.
  It sends `DELETE /todos/{id}`, with the id URL-encoded, and reads
  `DeletedReply`.
- New `apps/bff/src/lib/server/todos/remove-todo.ts`,
  `removeTodo(api, form)`:

  | Case | Result |
  |------|--------|
  | No `id` in the form | `fail(422)`, "Something went wrong. Try again." |
  | API `not_found` | `{ removed: id }` |
  | Any other API failure | `fail(status(kind))`, "Something went wrong. Try again." |
  | Success | `{ removed: id }` |

  Every failure carries `{ remove: { id, message } }`.
- `+page.server.ts` adds the `remove` action.

**Why.**
- Q2: the action and the page say remove; the call to the API says
  delete.
- Q5: a todo that is already gone is what the person asked for. The
  reload drops the row either way.

**Raised.**
6. A todo removed in another tab disappears without a word. A toggle
   or edit of a gone todo still says "Something went wrong".
7. `text()` is now copied in three actions: `toggle-todo.ts`,
   `edit-todo.ts` and `remove-todo.ts` (slice 4 tour item 9).

## 6. BFF UI (Q6–Q10)

**Shown.** `TodoItem.svelte`:
- **Markup** (lines 286–301). After the row's body, inside
  `{#if !editing}`, there is a `?/remove` form with a hidden `id`. The
  submit button is `.remove` with `aria-label="Remove ‘{title}’"`. It
  holds the design's 16px ×, with `aria-hidden`.
- **Failure** (lines 175–224, 282–284):
  - `removeFailure = $derived(removeError)` is seeded from the no-JS
    prop and set by the `remove` SubmitFunction.
  - It has its own `<p id="todo-remove-error-…" role="alert">`, apart
    from the toggle's.
  - The button points at it with `aria-describedby` when it shows.
- **The `remove` SubmitFunction:**
  - It clears the failure.
  - Before the row goes, it notes whether focus is in the row, and the
    next or previous row.
  - A failure sets the message and returns. There is no `update()`, so
    `form` is left alone.
  - Success runs `update()`. Then, if focus was in the row,
    `focusAfterRemove` moves it.
- **`focusAfterRemove`:**
  - It focuses the neighbouring row's `button.title`, if that row is
    still in the page.
  - Otherwise it focuses `#new-todo`.
- **CSS** (lines 454–501):
  - `.remove` takes the design's values. `.remove svg` sets the stroke,
    because the design's SVG attributes are moved into CSS.
  - It has `opacity: 0`, and `opacity: 1` under `.row:hover` and
    `.row:focus-within`.
  - `@media (hover: none)` always shows it.
  - Reduced motion is covered by the global rule in `app.css`.
- **`TodoList.svelte`:**
  - `errorFor` became `messageFor(failed, todo)`, used for both
    toggle and remove.
  - It passes each row `removeError`.
- **`+page.svelte`** derives `removeFailed` from `form.remove`.
- The Svelte autofixer is clean on all three files.

**Why.**
- Q6: a submit button in a form works without JS, as toggle does.
- Q7: waiting for the reply means a failure never has to bring a row
  back.
- Q8: each form keeps its own failure (slice 4 tour, §7a).
- Q9: the focused button goes with its row. Without a move, focus
  falls to the page.
- Q10: deviation 11, and the design's `.row:hover`/`.row:focus-within`
  rules. The design's `.touch` class is set by its own script, and
  `(hover: none)` is the CSS for "a device that cannot hover".
  Deviation 18 hides only the remove button while editing.

**Raised.**
8. **Focus is found through the DOM.** `focusAfterRemove` relies on
   the class `title` on another row's button and on `NewTodo`'s id
   `new-todo`. A rename of either breaks focus silently. The other
   ways are for `TodoList` to own focus, or to pass a callback down.
9. **A mouse remove moves focus too.** Chromium focuses a clicked
   button, so after a mouse remove focus moves to the next row's
   title. That row's × then shows, through `:focus-within`, even
   without hover. It makes removing several in a row easy, but it is
   a change the person did not ask for.
10. **A failed remove does not reload,** unlike a failed toggle. The
    row is still there with its message. If the failure was really a
    lost reply, the row stays until the next load.
11. **Nothing shows while a remove is in flight.** A second click
    sends a second `DELETE`. It gets a 404, which counts as removed
    (Q5), so this is harmless.
12. A row can show the toggle message and the remove message at once.
13. "Each form keeps its own failure" is now in four places: add,
    toggle, edit and remove (slice 4 tour item 10).

## 7. Tests

**Shown.**
- **Unit:**
  - contract, 2: `DeletedReply` reads `{ id }` and refuses more.
  - operations, 3: `delete-todo.test.ts`. It returns the id, `false`
    gives `not_found`, and a store failure is wrapped.
  - d1, 4: `deleteTodo` binds the id, 1 change is deleted, 0 is not,
    and a D1 failure passes up. `store.test.ts` lists the method.
  - api, 4:
    - `delete-todo.test.ts`, 3: success with the id, `not_found`
      404, and `internal` 500 without the cause.
    - `construct.test.ts`, 1: the fake store gains `deleteTodo`. A
      delete empties the list, and a second delete is a 404.
  - bff, 5: `remove-todo.test.ts`, the §5 table, plus the
    URL-encoded path and a binding that cannot be reached.
- **Integration:** `apps/api/test/integration/todos-delete.test.ts`,
  2:
  - only the named todo is deleted, and its id is answered;
  - a second delete and an unknown id are both 404.
- **E2e:**
  - New `apps/bff/e2e/delete.test.ts`, 5.1 and 5.2.
    - `removeAll` removes every todo through the page, hovering over
      each row first.
    - 5.1 then adds "buy milk" and "walk dog", hovers and removes
      "buy milk". It checks one row, "walk dog", before and after a
      reload.
    - 5.2 removes the only todo and checks there is no list and no
      footer.
  - `edit.test.ts`:
    - 4.1 now checks that the remove button is not in the page while
      editing. The comment that put it off is gone.
    - `titleOf` matches names that start with the title, with its
      characters escaped. The remove button's name holds the title
      too, so the old substring match found two buttons.
- **Checked once, not kept.** A temporary e2e file confirmed four
  things, then was deleted:
  - the button's opacity is 0 at rest and 1 on focus;
  - a keyboard remove moves focus to the next row's title;
  - a keyboard remove of the last row moves focus to the previous
    row's title;
  - a remove without JS works.

**Why.**
- Q11: the delete file runs second, after add-and-list, so the list
  is never empty at its start. Removing through the page uses only the
  slice's own feature.
- The PRD says e2e runs exactly its scenarios, so the extra checks
  were not kept.

**Raised.**
14. Focus, no-JS remove and the opacity rules have no kept test. A
    unit test of the component, or e2e beyond the PRD's scenarios,
    would hold them.
15. `delete.test.ts` empties the shared database in the middle of the
    run. The edit and toggle files run after it, and they pass because
    they count relative to what is there. The file order is by name
    (D19).
16. Slice 4 tour item 17 is out of date. `dev:e2e` deletes the e2e
    database every run, and remove now exists.
17. `titleOf`'s escaping is a regex built from text. The titles are
    `unique()` words today, so the escaping is a guard, not a need.

## 8. What the UI shows now

- Each row has a × at its right edge. It shows when the row is hovered
  or has focus, and always on a touch screen.
- Clicking it, or pressing Enter or Space on it, removes the todo.
  When the last one goes, the empty state shows.
- While a row is being edited, its × is gone.

## 9. Not done in this slice

- No findings file, and no profile-notes entries. Stage 06's
  close-out is still paused (handoff 07, "Open, carried").
- Not checked by eye in light and dark.
- The slice 4 decisions are still open: the Q2 review, and the title
  button's name (slice 4 tour item 11).

## 10. Open for the owner

### Review: Claude's answers
1. Q3–Q11, in the table at the top.

### Smaller choices, kept unless the owner objects
2. The change count instead of `RETURNING` (item 3).
3. The handler alias and the shadowed name (item 4).
4. A gone todo is silently removed (item 6).
5. Focus found through the DOM (item 8).
6. Focus moves after a mouse remove too (item 9).
7. No reload after a failed remove (item 10).
8. No kept test for focus, no-JS remove or opacity (item 14).

### Candidates for profile-notes
9. Each form keeps its own failure, now in four places (item 13).
10. API words and UI words may differ: the API says delete, the page
    says remove (Q2).

### Housekeeping before the slice 5 commit
11. Handoff 07 is untracked and goes in the slice 5 commit, with this
    report.
12. Mark slice 4 tour item 17 as out of date, or leave it (item 16).
