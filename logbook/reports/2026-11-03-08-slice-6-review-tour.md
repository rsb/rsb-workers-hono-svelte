# Review tour: slice 6 (Mark all as complete), api and BFF, 2026-11-03

Claude wrote this tour of slice 6 for the owner to review against the
code. It was written, not led live. The order is the api story's:
contract → operations → data → handlers and construct. Then the BFF:
server, then UI, then the tests.

The code toured is the working tree of `feat/slice-6-mark-all`, on
`2b5131c`, before the slice 6 commit. The change is 18 files changed
and 10 new, not counting handoff 08 and this report.

Checks on that tree:
- `pnpm check` is clean.
- `test:unit`: 191 tests (fail 6, business 1, contract 24, valid 6,
  operations 14, d1 52, bff 48, api 40). Slice 5 ended at 165.
- `test:integration`: 23, up from 19.
- `test:e2e`: 31, up from 26.

There is no decisions draft for this slice. "Why" cites the step 3
questions of
[handoff 08](../handoffs/2026-11-02-08-slice-5-delete.md) as Q1–Q12,
and the answers to them. The owner asked Claude to answer all of them:
"you know the routine. Answer all of them once all the slices are done
we will have a final review since there will be enough complexity for
us to sort out". So Q1–Q12 are Claude's, for the final review.

| Q | Question | Answer |
|---|----------|--------|
| Q1 | Naming | Body `PatchTodosBody`, handler `patchTodos`, operation and port method `setAllCompleted`, BFF client `patchTodos`, action `markAll` (`markAllTodos`) |
| Q2 | The body | `v.strictObject({ completed: v.boolean("completed must be true or false") })` |
| Q3 | The reply | `TodoListReply`, reused |
| Q4 | The store, and its order | One `db.batch([update, select])`, so one transaction, through a new driver helper `writeThenQueryAll` |
| Q5 | The form inside another form | A separate empty `<form id="mark-all">`; the button joins it with `form="mark-all"` |
| Q6 | What the button sends | The new value, `String(!allDone)`, not "flip it" |
| Q7 | Where the pressed state comes from | Worked out in `+page.svelte`: `hasTodos && data.active === 0` |
| Q8 | Without JS | A plain form post |
| Q9 | With JS, when the rows change | When the reply comes; nothing changes at once |
| Q10 | A failed mark all | Its own message under the line, and a reload |
| Q11 | Mark all while editing | The two posts commute; checked once by hand, not kept |
| Q12 | E2e "given two active todos" | A shared helper file, `apps/bff/e2e/todos.ts` |

Each stop lists what was shown, why, and the points raised. "Raised"
means Claude's notes for the review, not agreed or changed. §10
collects them.

## 1. Contract (Q1–Q3)

**Shown.** `packages/contract/api/src/todos.ts` adds
`PatchTodosBody = v.strictObject({ completed: v.boolean(…) })` and its
type, exported from `index.ts`. `TodoListReply`'s doc now says it is
the data of both `GET /todos` and `PATCH /todos`.

**Why.**
- Q2: the PRD's API table says `PATCH /todos` takes `{ completed }`,
  or answers 422 `completed`. The message is `PatchTodoBody`'s.
- Q3: the table says "200 all todos", which is `TodoListReply`.

**Raised.**
1. **A missing `completed` gets valibot's message,** "Invalid key:
   Expected \"completed\" but received undefined", not "completed
   must be true or false". The field is still `completed`. A missing
   `title` on `POST /todos` already behaves the same, so the test
   checks only the field. Handoff 08 expected the 422 with
   `field: "completed"`, which holds; it did not say which message.

## 2. Operations (Q1)

**Shown.** New `packages/operations/src/todos/set-all-completed.ts`:
- The port is `SetAllCompletedStore.setAllCompleted(completed)`. It
  answers every todo as it now is, in the order they were added.
- The operation `setAllCompleted({ dbStore })(completed)` wraps a
  store failure as "set all completed". No todos is not a failure: the
  list comes back empty.

**Why.** Q1: the operation names what it does to the data. The page
says "mark all", as slice 5 let API words and UI words differ.

**Raised.**
2. The operation has no rule of its own. It only passes the value on
   and wraps the failure.

## 3. Data, D1 (Q4)

**Shown.**
- `packages/data/d1/src/driver.ts:45`, new `writeThenQueryAll(db,
  write, read, context)`:
  - It builds both statements inside the `try`, runs
    `db.batch([written, reading])`, and returns the read's rows.
  - A missing second result is a `serverFault`, "the batch returned
    no result for the read".
  - A thrown error goes through `classify`, as in `queryAll` and
    `execute`.
- `packages/data/d1/src/todos.ts`:
  - **Stmt:** `setAllCompletedStmt` is
    `UPDATE todos SET completed = ?1`.
  - **Raw:** `setAllCompletedRaw` runs it with `selectTodosStmt`
    through `writeThenQueryAll`, named "set all completed".
  - **Outer:** `setAllCompleted(completed)` turns the boolean into the
    row's flag, and the rows into todos.
- The test fake `fake-d1.ts` gains `batch`. It records how many
  statements each batch had. `store.test.ts` lists the new method.

**Why.** `RETURNING` cannot be ordered, and the list is in `seq`
order. A batch is one transaction in D1, so the update and the read
are one step: the list returned is the list the update made.

**Raised.**
3. **The first transaction in the project.** `writeThenQueryAll` is a
   new kind of driver helper, shaped for this one use: one write, then
   one read. A second use may want a more general batch.
4. Atomicity is D1's promise, not tested here. The unit tests use the
   fake's `batch`; the integration tests check the result, not a
   failure halfway through.
5. The guard for a missing second result can only be reached through
   the fake.

## 4. API handler and construct (Q1)

**Shown.**
- New `apps/api/src/app/handlers/todos/patch-todos.ts`,
  `patchTodos(setAllCompleted)`:
  1. validate the body with `PatchTodosBody`; a bad body is a
     `userFailure` (422);
  2. run the operation; a failure goes through `mapFailure` (500
     `internal`);
  3. on success, `success(c, todos.map(presentTodo))`.
- `construct.ts`:
  - `Operations` gains `setAllCompleted`, built with the shared
    `dbStore` (line 52).
  - The route table adds `PATCH /todos`, before `/todos/:id`
    (line 61).

**Why.** Handlers are named by their HTTP method and path:
`patchTodos` is `PATCH /todos`, as `getTodos` is `GET /todos`.

**Raised.**
6. **`patchTodos` and `patchTodo` differ by one letter,** in the
   handlers and in the BFF client. It follows the naming rule, but
   they are easy to confuse.

## 5. BFF server (Q1, Q6)

**Shown.**
- `apps/bff/src/lib/server/api/todos.ts` adds `patchTodos(api, body)`.
  It sends `PATCH /todos` with the body as JSON and reads
  `TodoListReply`. The imports are now one per line.
- New `apps/bff/src/lib/server/todos/mark-all-todos.ts`,
  `markAllTodos(api, form)`:

  | Case | Result |
  |------|--------|
  | `completed` is not `"true"` or `"false"` | `fail(422)`, "Something went wrong. Try again." |
  | Any API failure | `fail(status(kind))`, "Something went wrong. Try again." |
  | Success | `{ markedAll: value }` |

  Every failure carries `{ markAll: { message } }`.
- `+page.server.ts` adds the `markAll` action.

**Why.** Q6: the button sends the value every todo should take, so
sending it twice is safe. A value the page never sends did not come
from it, so the person gets the general message.

**Raised.**
7. Nothing reads `{ markedAll }`. It is there so a success has a
   shape, as `{ removed }` does.

## 6. BFF UI (Q5–Q10)

**Shown.**
- **`+page.svelte`:**
  - `markAllFailed` is derived from `form.markAll`.
  - `allDone = hasTodos && data.active === 0`.
  - Both go to `NewTodo` with `hasTodos`.
- **`NewTodo.svelte`, markup** (lines 75–127):
  - An empty `<form id="mark-all" method="POST" action="?/markAll">`
    sits before the add form.
  - The `.toggle-slot` in the add line holds, under `{#if hasTodos}`,
    a `<button type="submit" form="mark-all" name="completed">`. It
    carries `value={markAllValue}`, `aria-pressed={allDone}` and
    `aria-label="Mark all as complete"`. It holds the design's 12px
    tick, with `aria-hidden`.
  - The slot is no longer `aria-hidden`, and its "comes with slice 6"
    comment is gone.
  - `<p id="mark-all-error" role="alert">` shows under the add line
    when there is a message.
- **`NewTodo.svelte`, script** (lines 48–72):
  - `markAllValue = String(!allDone)`.
  - `markAllError` is seeded from the no-JS prop and set by the
    `markAll` SubmitFunction.
  - `markAll` clears the message. A failure sets it and calls
    `invalidateAll()`. Success runs `update()`.
- **CSS** (lines 154–180): `.toggle-all`, its `:hover` and `.is-on`,
  with the design's values. The pointer cursor, `:focus-visible` and
  reduced motion come from `app.css`.
- The Svelte autofixer is clean on both files.

**Why.**
- Q5: HTML does not allow a form inside a form. A separate form keeps
  the add form unchanged, and a press never sends the title.
- Q7: `active` already comes from `load-todos.ts`, so the page needs
  nothing new from the server.
- Q8: a submit button in a form works without JS, as toggle and
  remove do.
- Q9: waiting for the reply means a failure never has to put rows
  back, as with remove.
- Q10: each form keeps its own failure (slice 4 tour, §7a). The reload
  shows the todos as they really are, as a failed toggle does.

**Raised.**
8. **The mark-all message sits inside the add form,** though it
   belongs to the `mark-all` form. It is placed there so it shows
   under the line. The button does not point at it with
   `aria-describedby`.
9. **A failed mark all reloads; a failed remove does not** (slice 5
   tour item 10). Toggle reloads. The three are not yet one rule.
10. **Nothing shows while a mark all is in flight.** A second press
    sends the same value again, so it is harmless.
11. "Each form keeps its own failure" is now in five places: add,
    toggle, edit, remove and mark all.
12. The button's value and pressed state come from the page as it was
    loaded. A todo changed in another tab can make a press send the
    "wrong" value; the reply then shows what is true.

## 7. Tests

**Shown.**
- **Unit:**
  - contract, 4: `PatchTodosBody` refuses a non-boolean, a missing
    `completed` (field only), and an unknown key, and passes
    `completed` through.
  - operations, 3: `set-all-completed.test.ts`.
  - d1, 6: `writeThenQueryAll`, 3, and `setAllCompleted`, 3.
  - api, 7:
    - `patch-todos.test.ts`, 6: not JSON, not a boolean, missing
      `completed`, an unknown key, success, and `internal` 500
      without the cause.
    - `construct.test.ts`, 1: mark all completes every todo, then
      makes every todo active again.
  - bff, 6: `mark-all-todos.test.ts`, 5 (the §5 table and its
    cases), and one `patchTodos` client test.
- **Integration:** `apps/api/test/integration/todos-mark-all.test.ts`,
  4:
  - an empty list answers an empty list;
  - every todo is completed, in order;
  - every todo is made active, and sending it twice is safe;
  - `{}` is a 422.
- **E2e:**
  - New shared `apps/bff/e2e/todos.ts`: `input`, `items`, `rowOf`,
    `open`, `add` (it waits for the row) and `removeAll`.
  - `delete.test.ts` imports them, and keeps `removeOf` and `remove`.
    Its tests are unchanged.
  - New `apps/bff/e2e/mark-all.test.ts`: no button without todos, then
    6.1–6.4. Each test first removes every todo, then adds "buy milk"
    and "walk dog". It checks `aria-pressed` and the checkboxes.
  - `toggle-and-counter.test.ts`: its header comment now says earlier
    files leave todos behind.
- **Checked once, not kept.** A temporary e2e file confirmed two
  things, then was deleted:
  - with JS off, mark all works as a plain form post, both ways;
  - editing a title, then pressing mark all, keeps both changes, still
    there after a reload (Q11).

**Why.**
- Q11: the blur saves the edit, which sends only `title`. Mark all
  sends only `completed`. Either order gives the same rows.
- Q12: `delete.test.ts` and `mark-all.test.ts` both need to empty the
  list first. One copy of the helpers is easier to keep right.
- The PRD says e2e runs exactly its scenarios, so the extra checks
  were not kept.

**Raised.**
13. No kept test for mark all without JS, for edit then mark all, or
    for the failure message in the browser. The failure path is
    covered by unit tests only.
14. The extra e2e test ("no mark all without todos") is not a PRD
    scenario. It covers deviation 20's "shown only when there are
    todos", which scenario 7.3 will need.
15. `mark-all.test.ts` empties the shared database in each test. It
    runs before `toggle-and-counter.test.ts`, which still passes
    because it counts from what is there.

## 8. What the UI shows now

- When there are todos, a round tick button sits at the left of the
  new-todo line. It fills with the accent colour when every todo is
  done.
- Pressing it completes every todo; pressing it again makes them all
  active. Checking or unchecking rows by hand updates it.
- A failed mark all shows "Something went wrong. Try again." under the
  line, apart from the add message.

## 9. Not done in this slice

- No findings file, and no profile-notes entries. Stage 06's
  close-out is still paused (handoff 08, "Open, carried").
- Not checked by eye in light and dark.
- No real API failure was made in the browser.
- The slice 4 and 5 items carried in handoff 08 are unchanged.

## 10. Open for the owner, at the final review

### Review: Claude's answers
1. Q1–Q12, in the table at the top.

### Smaller choices, kept unless the owner objects
2. Valibot's message for a missing `completed` (item 1).
3. `writeThenQueryAll`, the first transaction helper (items 3–5).
4. `patchTodos` beside `patchTodo` (item 6).
5. The mark-all message inside the add form, with no
   `aria-describedby` (item 8).
6. Reload after failure: yes for toggle and mark all, no for remove
   (item 9).
7. No kept test for no-JS, edit then mark all, or the failure in the
   browser (item 13).

### Candidates for profile-notes
8. Each form keeps its own failure, now in five places (item 11).
9. A button outside its form, joined by the `form` attribute, when
   the design puts it inside another form (Q5).
10. A write and its read as one D1 batch (Q4).

### Housekeeping
11. Handoff 08 says §10 of the slice 5 tour has the owner's review of
    Q3–Q11. That §10 only lists them as open. They are treated as kept.
12. Handoff 08 is untracked and goes in the slice 6 commit, with this
    report.
