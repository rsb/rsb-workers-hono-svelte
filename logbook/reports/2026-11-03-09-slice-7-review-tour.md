# Review tour: slice 7 (Clear completed), api and BFF, 2026-11-03

Claude wrote this tour of slice 7 for the owner to review against the
code. It was written, not led live. The order is the api story's:
contract → operations → data → handlers and construct. Then the BFF:
server, then UI, then the tests.

The code toured is the working tree of `feat/slice-7-clear-completed`,
on `98290f4`, before the slice 7 commit. The change is 16 files changed
and 8 new, not counting handoff 09 and this report.

Checks on that tree:
- `pnpm check` is clean.
- `test:unit`: 213 tests (fail 6, business 1, contract 28, valid 6,
  operations 17, d1 55, bff 53, api 47). Slice 6 ended at 191.
- `test:integration`: 26, up from 23.
- `test:e2e`: 34, up from 31.

There is no decisions draft for this slice. "Why" cites the step 3
questions of
[handoff 09](../handoffs/2026-11-03-09-slice-6-mark-all.md) as Q1–Q13,
and the answers to them. The owner said: "yes answer all the 13 and
note down your answers in your tour so we can speak to them in our
final review". So Q1–Q13 are Claude's, for the final review.

| Q | Question | Answer |
|---|----------|--------|
| Q1 | Naming | Query `DeleteTodosQuery`, handler `deleteTodos`, operation and port method `deleteCompleted` (`DeleteCompletedStore`), BFF client `deleteTodos(api, query)`, action `clearCompleted` (`clearCompletedTodos`) |
| Q2 | The query | A contract schema, `v.strictObject({ completed: v.literal("true", "completed must be true") })`, read by a new `validateQuery`. Unknown keys are refused; a key given twice is refused; a missing `completed` gets valibot's message |
| Q3 | The reply | `TodoListReply`, reused |
| Q4 | The store | `DELETE FROM todos WHERE completed = 1`, then `selectTodosStmt`, as one batch through `writeThenQueryAll`, unchanged |
| Q5 | Nothing to clear | A success: the list as it was |
| Q6 | Where "any completed" comes from | A `completed` count in `load-todos.ts`, beside `active` |
| Q7 | The form | Its own `?/clearCompleted` form in the footer, with no fields; the button is its submit |
| Q8 | Without JS | A plain form post |
| Q9 | With JS, when the rows go | When the reply comes |
| Q10 | A failed clear | Its own `role="alert"` message in the footer, across all three columns, and a reload |
| Q11 | Focus after a clear | If the button had focus, to `#new-todo` |
| Q12 | Clear while editing | Nothing changed; checked once by hand, not kept |
| Q13 | E2e "given" | Each test starts with `removeAll` from `e2e/todos.ts` |

Each stop lists what was shown, why, and the points raised. "Raised"
means Claude's notes for the review, not agreed or changed. §10
collects them.

## 1. Contract (Q1–Q3)

**Shown.** `packages/contract/api/src/todos.ts` adds
`DeleteTodosQuery = v.strictObject({ completed: v.literal("true", …) })`
and its type, exported from `index.ts`. `TodoListReply`'s doc now names
`GET`, `PATCH` and `DELETE /todos`.

**Why.**
- Q2: the PRD's rule is "`DELETE /todos` without `completed=true` is a
  422 with `field: "completed"`, never "delete all"". A query value is
  text, so the schema takes the literal `"true"`, not a boolean.
- Q3: the PRD's table says "200 the remaining todos", which is
  `TodoListReply`.

**Raised.**
1. **The first query schema.** Its values are strings, where the body
   schemas take JSON types. `completed=false` is refused with
   "completed must be true".
2. A missing `completed` gets valibot's message, as in slice 6
   (slice 6 tour, item 1). The tests check only the field.

## 2. Operations (Q1, Q5)

**Shown.** New `packages/operations/src/todos/delete-completed.ts`:
- The port is `DeleteCompletedStore.deleteCompleted()`. It answers the
  todos left, in the order they were added.
- The operation `deleteCompleted({ dbStore })()` wraps a store failure
  as "delete completed". Nothing to clear is not a failure.

**Why.** Q1: the operation names what it does to the data, and the page
says "Clear completed", as with mark all. The name differs from the
handler's, so `construct.ts` needs no new alias.

**Raised.**
3. Like `setAllCompleted`, the operation has no rule of its own.

## 3. Data, D1 (Q4)

**Shown.** `packages/data/d1/src/todos.ts`:
- **Stmt** (line 66): `deleteCompletedStmt` is
  `DELETE FROM todos WHERE completed = 1`. It binds nothing.
- **Raw** (line 107): `deleteCompletedRaw` runs it with
  `selectTodosStmt` through `writeThenQueryAll`, named
  "delete completed".
- **Outer** (line 207): `deleteCompleted()` turns the rows into todos.
- `store.test.ts` lists the new method.

**Why.** The list is in `seq` order, and the batch is one transaction,
so the list returned is what the delete left. The driver and the fake
needed nothing new.

**Raised.**
4. **`writeThenQueryAll`'s second use fits it as it is** (slice 6 tour,
   item 3, asked whether it would). Both uses are "one write, then the
   ordered list".

## 4. API handler and construct (Q1, Q2)

**Shown.**
- `apps/api/src/app/handlers/validate.ts`:
  - New `validateQuery(c, schema)` (line 48). It reads
    `c.req.queries()`, refuses a key given more than once ("completed
    must be given once"), then safe-parses the rest as strings. With no
    path key, the field is `query`.
  - The issue-to-`invalid` step moves into a shared `firstInvalid`
    (line 10), used by `validateBody` and `validateQuery`.
    `validateBody`'s behaviour is unchanged.
- New `apps/api/src/app/handlers/todos/delete-todos.ts`,
  `deleteTodos(deleteCompleted)`: validate the query (422), run the
  operation (500 on failure), then `success` with the todos presented.
- `construct.ts`: `Operations` gains `deleteCompleted` (line 57), and
  the routes add `DELETE /todos` before `/todos/:id` (line 67).

**Why.**
- Q2: Hono's `c.req.query()` keeps the first value of a repeated key,
  so `?completed=true&completed=false` would pass as `true`.
  `queries()` sees both.
- A query schema in the contract, read by a helper next to
  `validateBody`, is the shape slice 8's `GET /todos?completed=` can
  reuse.

**Raised.**
5. **`deleteTodos` and `deleteTodo` differ by one letter,** as
   `patchTodos` and `patchTodo` do (slice 6 tour, item 6).
6. **The repeated-key rule is new** and applies to every future query.
   Bodies cannot repeat a key in the same way, since JSON parsing keeps
   the last.
7. `validateQuery` has no unit test of its own. Its cases are covered
   through `delete-todos.test.ts`, as `validateBody`'s are through the
   handlers.

## 5. BFF server (Q1, Q6, Q7)

**Shown.**
- `apps/bff/src/lib/server/api/todos.ts` adds
  `deleteTodos(api, query)`. It builds the path with
  `URLSearchParams`, sends `DELETE` and reads `TodoListReply`.
- `load-todos.ts`: `TodosPage` gains `completed`, counted as
  `todos.length - active`. It is 0 when the load fails.
- New `apps/bff/src/lib/server/todos/clear-completed-todos.ts`,
  `clearCompletedTodos(api)`:

  | Case | Result |
  |------|--------|
  | Any API failure | `fail(status(kind))`, "Something went wrong. Try again." |
  | Success | `{ cleared: true }` |

  A failure carries `{ clearCompleted: { message } }`.
- `+page.server.ts` adds the `clearCompleted` action. It does not read
  the form data.

**Why.**
- Q6: on `/active` (slice 8) the list is filtered, so
  `todos.length - active` worked out in the page would be wrong there
  (scenario 8.7). With the count in the load, slice 8 changes only
  where the counts come from.
- Q7: the action always sends `completed=true`. The form has nothing to
  send, so the action has nothing to check.

**Raised.**
8. Nothing reads `{ cleared: true }`, as nothing reads `{ markedAll }`
   (slice 6 tour, item 7).
9. `clearCompletedTodos` takes only `api`, where every other action
   takes `(api, form)`.

## 6. BFF UI (Q7–Q11)

**Shown.**
- **`+page.svelte`:** `clearFailed` is derived from
  `form.clearCompleted`. `TodoFooter` gets `completed={data.completed}`
  and `clearFailed`.
- **`TodoFooter.svelte`, markup** (lines 57–68):
  - Under `{#if anyCompleted}`, a
    `<form method="POST" action="?/clearCompleted" class="clear-form">`
    holds `<button type="submit" class="clear">Clear completed</button>`.
  - `<p id="clear-completed-error" class="clear-error" role="alert">`
    shows when there is a message.
  - The comment now says only the filters are still to come.
- **Script** (lines 24–54):
  - `anyCompleted = completed > 0`.
  - `clearError` is seeded from the no-JS prop and set by the
    `clearCompleted` SubmitFunction.
  - That clears the message and notes whether the submitter had focus.
    A failure sets the message and calls `invalidateAll()`. Success
    runs `update()`, then focuses `#new-todo` if the button had focus.
- **CSS:**
  - `.clear` and `.clear:hover` use the design's values.
  - The design's inline `justify-self: end; margin-right: -10px` sits
    on `.clear-form`, in `grid-column: 3`.
  - `.clear-error` spans `1 / -1`.
- The Svelte autofixer is clean.

**Why.**
- Q7: its own form, as each action has, so it works with no JS.
- Q8, Q9: as with remove and mark all.
- Q10: each form keeps its own failure. A batch fails as a whole, so on
  a failure the rows are still there and so is the footer; the reload
  shows them as they really are, as for mark all.
- Q11: the button goes with the cleared rows, and focus would fall to
  the body. `#new-todo` is where a remove of the last row sends it.

**Raised.**
10. **Focus moves only after a cleared list.** If some rows are left
    and the button is gone, focus still goes to `#new-todo`, not to a
    row.
11. **The form wraps the button,** so the grid places the form, not the
    button. The design's inline style is on the form instead.
12. Reload after failure: now yes for toggle, mark all and clear, no for
    remove (slice 6 tour, item 9).
13. "Each form keeps its own failure" is now in six places.

## 7. Tests

**Shown.**
- **Unit:**
  - contract, 4: `DeleteTodosQuery` refuses `"false"`, a missing
    `completed` (field only) and an unknown key, and passes `"true"`
    through.
  - operations, 3: `delete-completed.test.ts`.
  - d1, 3: one batch of two that binds nothing, rows read as todos, and
    a D1 failure named "delete completed".
  - api, 7:
    - `delete-todos.test.ts`, 6: no query, `completed=false`, the key
      twice, an unknown key, success, and `internal` 500.
    - `construct.test.ts`, 1: a bare `DELETE /todos` is a 422 and
      deletes nothing, then a clear leaves only the active todo. The
      fake store gains `deleteCompleted`.
  - bff, 5: `clear-completed-todos.test.ts`, 4 (an API failure,
    unreachable, a 422 passed on, success with the URL sent), and one
    `deleteTodos` client test. `load-todos.test.ts` checks the new
    count.
- **Integration:**
  `apps/api/test/integration/todos-clear-completed.test.ts`, 3:
  - only the completed todo goes, the rest in order, and the next list
    agrees;
  - nothing completed gives the list as it was;
  - no query is a 422 and deletes nothing.
- **E2e:** new `apps/bff/e2e/clear-completed.test.ts`, 7.1–7.3. It runs
  2nd in name order. Each test first removes every todo, then adds "buy
  milk" and "walk dog".
  - 7.1 also checks the button shows once a todo is completed.
  - 7.2 checks the counter and a reload.
  - 7.3 clears from the keyboard and checks that focus is on
    `#new-todo`.
- **Checked once, not kept.** These ran, then were deleted:
  - with JS off, a clear works as a plain post (it passed in a full
    e2e run);
  - Q12: editing the completed "buy milk", typing, then clicking Clear
    completed leaves only "walk dog", with no alert and no open edit.

**Why.**
- Q12: the blur posts the edit, then the clear posts. If the edit comes
  first, it saves and the todo is cleared. If the clear comes first,
  the edit gets a 404; its row is gone by the time the page reloads, so
  no message shows. Either way the page shows what is true.
- The PRD says e2e runs exactly its scenarios, so the extra checks were
  not kept.

**Raised.**
14. No kept test for no-JS, clear while editing, or the failure message
    in the browser. The failure path is covered by unit tests only.
15. The run did not show which order Q12's two posts came in. A 404
    from the edit that shows in an open edit is possible only if the
    row survives the reload, which it cannot here.

## 8. What the UI shows now

- When any todo is done, "Clear completed" shows at the right of the
  footer. Pressing it removes the done todos; the button goes once none
  are left.
- When every todo was done, the list, the footer and mark all all go.
- A failed clear shows "Something went wrong. Try again." under the
  footer row.

## 9. Not done in this slice

- No findings file, and no profile-notes entries. Stage 06's close-out
  is still paused (handoff 09, "Open, carried").
- Not checked by eye in light and dark.
- No real API failure was made in the browser.
- The slice 4–6 items carried in handoff 09 are unchanged.

## 10. Open for the owner, at the final review

### Review: Claude's answers
1. Q1–Q13, in the table at the top.

### Smaller choices, kept unless the owner objects
2. A query value is the literal `"true"`; valibot's message for a
   missing key (items 1–2).
3. A repeated query key is refused (item 6).
4. `deleteTodos` beside `deleteTodo` (item 5).
5. `clearCompletedTodos(api)` takes no form (item 9).
6. Focus goes to `#new-todo` even when rows are left (item 10).
7. The design's inline style on the form, not the button (item 11).
8. Reload after failure: yes for toggle, mark all and clear, no for
   remove (item 12).
9. No kept test for no-JS, clear while editing, or the failure in the
   browser (item 14).

### Candidates for profile-notes
10. `validateQuery` beside `validateBody`, with query schemas in the
    contract (Q2).
11. Counts the page shows come from the load, not worked out in the
    page (Q6).
12. Each form keeps its own failure, now in six places (item 13).

### Housekeeping
13. Handoff 09 is untracked and goes in the slice 7 commit, with this
    report.
