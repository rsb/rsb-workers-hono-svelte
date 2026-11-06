# Data cases: app

The data spec for the app database (L46): one entry per store call,
saying what the call promises and costs, never how it is written. The
SQL stays hand-written in `packages/data/d1/src/todos.ts`. Each entry's
Cost line is the number `packages/data/d1/test/unit/budgets.test.ts`
asserts; a change to one changes the other in the same commit (L36).
Use cases and features cite an entry as `data/app.md › <id>`.

Database: `APP_DB` (the D1 database `todo`), beside `IDENTITY_DB`
(`data/identity.md`, L42)
Tables: `todos` (`packages/data/d1/migrations/app/0001_todos.sql`)

Every entry:
- Failures: `unavailable` when D1 names a transient or quota error,
  `server` for anything else, our own bugs included
  (`packages/data/d1/src/classify.ts`). The D1 error stays the cause.
- A list comes back in the order the todos were added: every select
  orders by `seq`, the rowid (`todos.order`).
- No call takes a scope yet; from slice A each takes the actor's (L43).

## `todos.add_unless_full`
Whether a todo was inserted: it is not when the list already holds
`limit`.

- Port: `DbStore.addTodoUnlessFull`
- Used by: add-a-todo
- Input: a `Todo` and `limit` (`TODO_LIMIT`, from `todos.cap`)
- Result: `inserted | full` (`true` or `false`)
- Guarantee: the count and the insert are one statement, so two adds
  at `limit - 1` cannot both land (deviation 9). A retry is not safe:
  each add is given a fresh id (D13), so an add sent again after an
  unknown outcome can store a second todo. The `UNIQUE` on `id` only
  refuses the same id twice, as `server`.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Counts every row of `todos` to
  decide; writes 1.
- Rules: `todos.cap` (decided here), `todos.unique_id`, `todos.order`

## `todos.list`
The todos, all of them or those whose `completed` matches.

- Port: `DbStore.listTodos`
- Used by: list-todos
- Input: a `TodoFilter`
- Result: the todos, possibly none
- Guarantee: one statement, so one snapshot. Read only; a retry is
  safe.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Reads every row (no index on
  `completed`); writes none.
- Rules: `todos.order`

## `todos.counts`
How many todos are active and how many completed, across every todo.

- Port: `DbStore.countTodos`
- Used by: count-todos
- Input: none
- Result: `{ active, completed }`; no todos is two zeros
- Guarantee: both counts in one statement, so they describe one moment.
  Read only; a retry is safe.
- Failures: `unavailable`, `server`; also `server` if no row comes back,
  which an aggregate without `GROUP BY` never does
- Cost: 1 round trip, 1 statement. Reads every row; writes none.
- Rules: none

## `todos.update`
The todo after the patch, or none when no todo has the id.

- Port: `DbStore.updateTodo`
- Used by: change-a-todo
- Input: an id and a `TodoPatch`
- Result: the todo as it now is, or `null` (the operation's
  `todo.exists` does not hold)
- Guarantee: the update and the read back are one statement, so the
  todo returned is the one written. Each field is set, never flipped:
  a retry is safe.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Finds the row by the `UNIQUE` index
  on `id`; reads and writes at most 1.
- Rules: none

## `todos.set_all_completed`
Every todo after `completed` is set on all of them.

- Port: `DbStore.setAllCompleted`
- Used by: mark-all-completed
- Input: a `Completed`
- Result: every todo, as it now is
- Guarantee: the update and the read are one batch, which D1 runs as
  one transaction, so the list returned is exactly what was written.
  The value is set, never flipped: a retry is safe.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 2 statements. Writes every row, then reads every
  row.
- Rules: `todos.order`

## `todos.delete`
Whether a todo was deleted: it is not when no todo has the id.

- Port: `DbStore.deleteTodo`
- Used by: remove-a-todo
- Input: an id
- Result: `deleted | absent` (`true` or `false`; the operation's
  `todo.exists` does not hold on `false`)
- Guarantee: one statement. A retry reports `absent`, which the BFF
  treats as done.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Finds the row by the `UNIQUE` index
  on `id`; writes at most 1.
- Rules: none

## `todos.delete_completed`
The todos left after every completed one is deleted.

- Port: `DbStore.deleteCompleted`
- Used by: clear-completed
- Input: none
- Result: the todos left, possibly none
- Guarantee: the delete and the read are one batch, which D1 runs as
  one transaction, so the list returned is exactly what the delete
  left. A retry deletes nothing more and returns the same list.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 2 statements. Reads every row to delete the
  completed ones, then reads every row left.
- Rules: `todos.order`
