# Feature: keep a list of things to do

Id: `todos.list`
Area: `todos`
Slice: shipped, slices 2 to 8
Design: `design/2026-11-02-ui/` (boards named before the convention:
`desktop-light-list.png` is `list.default.desktop.light`; see the map
at the end). The product-wide design lines (theme, tokens, type,
wording, motion, focus) are the root's C-design; this feature does not
restate them.

## Purpose
A person keeps one list of todos: adds them, ticks them off, edits or
removes them, clears the finished ones, and looks at all, the active
or the completed ones. It is not shared, not ordered by hand, and not
larger than 500 items.

## Who
`member`, scope `own`: a person sees and changes only their list.
(Before slice A every request was the one implicit user; this line is
what slice A makes true.)

## Views

### `todos.list`
The one page of the app: the input at the top, the list, the footer
with the counter, the filters and the clear button.

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `todos.list.empty` | no list and no footer; a message points to the input, which has focus | list-todos › result, none | `list.empty` |
| `todos.list.default` | the todos in creation order; completed ones checked, struck through and dimmed; the counter; the filters; the clear button when any is completed | list-todos › result; count-todos › result | `list.default` |
| `todos.list.editing` | one row replaced by an input holding its title, focused; the other controls of that row hidden | bff (no chain runs until save) | `list.editing` |
| `todos.list.input_error` | the input keeps what was typed and shows "Title must be 1 to 256 characters" | bff (`valid` › `title.length`), before add-a-todo or change-a-todo is called | `list.input-error` |
| `todos.list.full` | the list at 500; adding is refused and the page says the list is full, with the number from the reply | add-a-todo › refused `limit` | `list.full` |
| `todos.list.action_failed` | the list as it was; the input, row or control whose action failed says "Something went wrong. Try again." | any action's use case › refused `unavailable` or `server`; change-a-todo › refused `not_found` | not drawn |

Filters are not states: `/`, `/active` and `/completed` render
`todos.list.default` or `todos.list.empty` over a filtered read.

The rule behind `input_error` is applied by `valid` in the BFF before
the api is called, in both deliveries; the api's own check is the
backstop and never produces this state. If the api refuses a title
anyway, that is skew between the deliveries, and the page shows
`action_failed`.

A read that fails when the page loads (list-todos or count-todos ›
refused `unavailable` or `server`) does not render this view: the page
renders the shell's `accounts.error.failed`
(`feature-accounts-shell.md`).

The frame around this view, the top bar with the account menu, is
`accounts.shell` (`feature-accounts-shell.md`); this feature cites it
and does not restate it.

## Inputs

| Input | Field | Rules |
| --- | --- | --- |
| New title | `title` | `title.length` |
| Edited title | `title` | `title.length`; an empty edit leaves the todo unchanged, in the BFF, without calling the api (deviation 19) |
| Filter | `completed` | wire rule in `api.md`; not an id here |

## Reads

| Read | Endpoint | Use case | Data cases |
| --- | --- | --- | --- |
| the list, filtered | `GET /todos?completed=` | list-todos | `todos.list` |
| the counts, on `/active` and `/completed` | `GET /todos/counts` | count-todos | `todos.counts` |

On `/` the counts are counted from the list, so the page reads once
(deviation 5).

## Actions

| Action | Endpoint | Use case | Leads to |
| --- | --- | --- | --- |
| add | `POST /todos` | add-a-todo | `default`; `input_error`; `full`; `action_failed` |
| toggle one | `PATCH /todos/:id` | change-a-todo | `default`; `action_failed` |
| edit title | `PATCH /todos/:id` | change-a-todo | `default`; `input_error`; `action_failed` |
| remove | `DELETE /todos/:id` | remove-a-todo | `default` or `empty`, also on `not_found`; `action_failed` |
| mark all | `PATCH /todos` | mark-all-completed | `default`; `action_failed` |
| clear completed | `DELETE /todos?completed=true` | clear-completed | `default` or `empty`; `action_failed` |

Removing a todo that is already gone is treated as done: the person
wanted it gone, and it is. Changing one that is gone is not: the
change did not happen, so the row says so.

## Budget
One page load: 1 api call on `/`, 2 on `/active` and `/completed`.
One action: 1 api call, then the page reloads its reads; the reload
counts against the load. Each api call is 1 store call; each store
call is 1 round trip to D1, of 1 statement, except mark all and clear
completed, which are 2 (`data/app.md`). Asserted in
`apps/bff/test/unit/budgets.test.ts`, `apps/api/test/unit/budgets.test.ts`
and `packages/data/d1/test/unit/budgets.test.ts`.

## Done
The acceptance scenarios, moved here from `prd/todo.md` in stage 22
with their numbers, so a citation such as "scenario 2.6" still names
the same scenario. Scenario 1 (Health) stays in the root: it is a
probe, not a user job. E2e runs exactly these, through the BFF. Each
cites the upstream sentence, or the deviation, it comes from.

### 2 Add and list
1. *Given* no todos, *when* I open `/`, *then* there is no list and no
   footer, and a message points to the input. ("When there are no
   todos, `#main` and `#footer` should be hidden."; 15)
2. *Given* I open `/`, *then* the new-todo input has focus. ("The input
   element should be focused when the page is loaded")
3. *Given* no todos, *when* I type "buy milk" and press Enter, *then*
   the list shows "buy milk" and the input is empty. ("Pressing Enter
   creates the todo, appends it to the todo list, and clears the
   input.")
4. *Given* "buy milk", *when* I add "walk dog", *then* "walk dog" is
   below "buy milk". ("appends it to the todo list")
5. *When* I add "  buy milk  ", *then* the list shows "buy milk".
   ("Make sure to `.trim()` the input")
6. *When* I press Enter on an input of only spaces, *then* no todo is
   added and I see "Title must be 1 to 256 characters". ("check that
   it's not empty before creating a new todo"; 16)
7. *When* I add a title of 257 characters, *then* no todo is added, I
   see "Title must be 1 to 256 characters", and the input still holds
   what I typed. (7, 16)
8. *Given* "buy milk", *when* I reload, *then* "buy milk" is still
   there. (Persistence; 3)

### 3 Toggle one and counter
1. *Given* "buy milk", active, *when* I click its checkbox, *then* it
   shows as completed. ("Clicking the checkbox marks the todo as
   complete")
2. *Given* "buy milk", completed, *when* I click its checkbox, *then*
   it shows as active. (same sentence, the toggle)
3. *Given* one active todo, *then* the counter reads "1 item left".
   ("`1 item`")
4. *Given* two active todos, *then* it reads "2 items left". ("`2 items`")
5. *Given* one todo, completed, *then* it reads "0 items left".
   ("`0 items`")

### 4 Edit
1. *Given* "buy milk", *when* I double-click its title, *then* an input
   holding "buy milk" appears with focus and the remove button is
   hidden. ("Double-clicking the `<label>` activates editing mode";
   "bring forward an input that contains the todo title, which should
   be focused"; 18)
2. *When* I change it to "buy oat milk" and press Enter, *then* the list
   shows "buy oat milk". ("The edit should be saved on both blur and
   enter")
3. *When* I change it to "buy oat milk" and click elsewhere, *then* the
   list shows "buy oat milk". (same sentence, blur)
4. *When* I change it to "  buy oat milk  " and press Enter, *then* the
   list shows "buy oat milk". ("Make sure to `.trim()` the input")
5. *When* I clear it and press Enter, *then* the list still shows "buy
   milk". (19)
6. *When* I change it and press Escape, *then* the list shows "buy
   milk". ("If escape is pressed during the edit … any changes be
   discarded.")
7. *When* I change it to 257 characters and press Enter, *then* the
   title is unchanged and I see "Title must be 1 to 256 characters"
   under the input. (7, 16)
8. *Given* I am editing, *when* I reload, *then* no todo is in editing
   mode. ("Editing mode should not be persisted.")
9. *Given* "buy milk", *when* I focus its title and press Enter,
   *then* an input holding "buy milk" appears with focus. (17)

### 5 Delete
1. *Given* "buy milk" and "walk dog", *when* I hover over "buy milk"
   and click its remove button, *then* only "walk dog" is left.
   ("Hovering over the todo shows the remove button"; 11)
2. *Given* only "buy milk", *when* I remove it, *then* there is no list
   and no footer. ("When there are no todos … hidden.")

### 6 Mark all as complete
1. *Given* two active todos, *when* I press "Mark all as complete",
   *then* both are completed. ("This checkbox toggles all the todos to
   the same state as itself."; 20)
2. *Given* two completed todos, *when* I press it again, *then* both
   are active. (same sentence; 20)
3. *Given* two active todos, *when* I check each one, *then* "Mark all"
   is pressed. ("When all the todos are checked it should also get
   checked."; 20)
4. *Given* all completed and "Mark all" pressed, *when* I uncheck one
   todo, *then* "Mark all" is not pressed. ("should also be updated
   when single todo items are checked/unchecked"; 20)

### 7 Clear completed
1. *Given* no completed todos, *then* "Clear completed" is not shown.
   ("Should be hidden when there are no completed todos.")
2. *Given* "buy milk" completed and "walk dog" active, *when* I click
   "Clear completed", *then* only "walk dog" is left. ("Removes
   completed todos when clicked.")
3. *Given* all completed and "Mark all" pressed, *when* I click "Clear
   completed", *then* "Mark all" is not shown, because no todos are
   left. ("Make sure to clear the checked state after the "Clear
   completed" button is clicked."; 20)

### 8 Filter
1. *Given* one active and one completed todo, *when* I open `/active`,
   *then* only the active one is listed. ("`#/active`"; 4, 5)
2. *When* I open `/completed`, *then* only the completed one is listed.
   ("`#/completed`"; 4, 5)
3. *When* I open `/`, *then* both are listed. ("`#/` (all - default)")
4. *Given* I am on `/active`, *then* the "Active" filter link is marked
   as current, and no other is. ("the `selected` class on the filter
   links should be toggled"; 10)
5. *Given* I am on `/active`, *when* I check a todo, *then* it is no
   longer listed. ("if the filter is `Active` and the item is checked,
   it should be hidden.")
6. *Given* I am on `/completed`, *when* I reload, *then* I am still on
   `/completed` with the same list. ("Make sure the active filter is
   persisted on reload.")
7. *Given* I am on `/active`, *then* the counter and "Clear completed"
   reflect all todos, not only those listed. (Counter, Clear completed;
   5: they come from `GET /todos/counts`)

## Board map
The first design was exported before the naming convention. Every
file in `design/2026-11-02-ui/`, and the board it is:

| File | Board |
| --- | --- |
| `desktop-light-empty.png` | `list.empty.desktop.light` |
| `mobile-light-empty.png` | `list.empty.mobile.light` |
| `desktop-light-list.png` | `list.default.desktop.light` |
| `desktop-dark-list.png` | `list.default.desktop.dark` |
| `mobile-light-list.png` | `list.default.mobile.light` |
| `desktop-light-editing-a-row.png` | `list.editing.desktop.light` |
| `desktop-dark-editing-a-row.png` | `list.editing.desktop.dark` |
| `mobile-dark-editing-a-row.png` | `list.editing.mobile.dark` |
| `desktop-light-input-error.png` | `list.input-error.desktop.light` |
| `mobile-light-input-error.png` | `list.input-error.mobile.light` |
| `desktop-light-list-full-500.png` | `list.full.desktop.light` |
| `mobile-dark-list-full-500.png` | `list.full.mobile.dark` |
| `todo-app.html` | not a board: the prototype every board was rendered from |

Every state has a board except `todos.list.action_failed`, which is
not drawn.
