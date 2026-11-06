# Data cases: app

The data spec for the app database (L46): one entry per store call,
saying what the call promises and costs, never how it is written. The
SQL stays hand-written in `packages/data/d1/src/todos.ts`. Each entry's
Cost line is the number `packages/data/d1/test/unit/budgets.test.ts`
asserts; a change to one changes the other in the same commit (L36).
Use cases and features cite an entry as `data/app.md › <id>`.

Database: `APP_DB` (the D1 database `todo`), beside `IDENTITY_DB`
(`data/identity.md`, L42)
Tables: `todos` (`packages/data/d1/migrations/app/0001_todos.sql`,
rebuilt with `user_id` and its index by `0002_todos_user_id.sql`)

Every entry:
- Failures: `unavailable` when D1 names a transient or quota error,
  `server` for anything else, our own bugs included
  (`packages/data/d1/src/classify.ts`). The D1 error stays the cause.
- A list comes back in the order the todos were added: every select
  orders by `seq`, the rowid (`todos.order`).
- Every call takes a scope first (L43): `{ ownerId }`, one owner's rows,
  or `{ any: true }`, every row. There is no default. A call reads and
  writes only the rows in its scope (`todos.scoped`); a row outside it is
  reported as absent, never as another's. An owner's rows are found by
  the index on `user_id`, which holds them in `seq` order. Every
  operation hands its actor's `{ ownerId }` in slice A (`access.md`).
- A Cost line is for `{ ownerId }`, the scope every operation hands
  today. Under `{ any: true }` the rows read are every row, as before
  owners; the round trips and statements are the same.

## `todos.add_unless_full`
Whether a todo was inserted: it is not when the list already holds
`limit`.

- Port: `DbStore.addTodoUnlessFull`
- Used by: add-a-todo
- Input: a `Todo` and `limit` (`TODO_LIMIT`, from `todos.cap`)
- Scope: `{ ownerId }` only: a new row needs an owner, so there is no
  insert for `{ any: true }`
- Result: `inserted | full` (`true` or `false`)
- Guarantee: the count and the insert are one statement, so two adds
  at `limit - 1` to one owner's list cannot both land (deviation 9). A retry is not safe:
  each add is given a fresh id (D13), so an add sent again after an
  unknown outcome can store a second todo. The `UNIQUE` on `id` only
  refuses the same id twice, as `server`.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Counts the owner's rows, by the
  index on `user_id`, to decide; writes 1.
- Rules: `todos.cap` (decided here, per owner), `todos.unique_id`,
  `todos.order`, `todos.scoped`

## `todos.list`
The todos, all of them or those whose `completed` matches.

- Port: `DbStore.listTodos`
- Used by: list-todos
- Input: a `TodoFilter`
- Scope: `{ ownerId }` or `{ any: true }`
- Result: the todos in scope, possibly none
- Guarantee: one statement, so one snapshot. Read only; a retry is
  safe.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Reads the owner's rows by the index
  on `user_id` (none on `completed`), in `seq` order with no sort;
  writes none.
- Rules: `todos.order`, `todos.scoped`

## `todos.counts`
How many todos in scope are active and how many completed.

- Port: `DbStore.countTodos`
- Used by: count-todos
- Input: none
- Scope: `{ ownerId }` or `{ any: true }`
- Result: `{ active, completed }`; no todos is two zeros
- Guarantee: both counts in one statement, so they describe one moment.
  Read only; a retry is safe.
- Failures: `unavailable`, `server`; also `server` if no row comes back,
  which an aggregate without `GROUP BY` never does
- Cost: 1 round trip, 1 statement. Reads the owner's rows by the index
  on `user_id`; writes none.
- Rules: `todos.scoped`

## `todos.update`
The todo after the patch, or none when no todo in scope has the id.

- Port: `DbStore.updateTodo`
- Used by: change-a-todo
- Input: an id and a `TodoPatch`
- Scope: `{ ownerId }` or `{ any: true }`
- Result: the todo as it now is, or `null`: no todo has the id, or
  one outside the scope has it, and the two are not told apart (the
  operation's `todo.exists` or `todo.owned` does not hold)
- Guarantee: the update and the read back are one statement, so the
  todo returned is the one written. The scope is in its `WHERE`, so
  there is no read before the write (L43). Each field is set, never
  flipped: a retry is safe.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Finds the row by the `UNIQUE` index
  on `id`, then checks its owner; reads and writes at most 1.
- Rules: `todos.scoped`

## `todos.set_all_completed`
Every todo in scope after `completed` is set on all of them.

- Port: `DbStore.setAllCompleted`
- Used by: mark-all-completed
- Input: a `Completed`
- Scope: `{ ownerId }` or `{ any: true }`
- Result: every todo in scope, as it now is
- Guarantee: the update and the read are one batch, which D1 runs as
  one transaction, so the list returned is exactly what was written.
  The value is set, never flipped: a retry is safe.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 2 statements. Writes the owner's rows, then reads
  them, each by the index on `user_id`.
- Rules: `todos.order`, `todos.scoped`

## `todos.delete`
Whether a todo was deleted: it is not when no todo in scope has the id.

- Port: `DbStore.deleteTodo`
- Used by: remove-a-todo
- Input: an id
- Scope: `{ ownerId }` or `{ any: true }`
- Result: `deleted | absent` (`true` or `false`): absent when no todo
  has the id or one outside the scope has it, not told apart (the
  operation's `todo.exists` or `todo.owned` does not hold on `false`)
- Guarantee: one statement. A retry reports `absent`, which the BFF
  treats as done.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Finds the row by the `UNIQUE` index
  on `id`, then checks its owner; writes at most 1.
- Rules: `todos.scoped`

## `todos.delete_completed`
The todos in scope left after every completed one in scope is deleted.

- Port: `DbStore.deleteCompleted`
- Used by: clear-completed
- Input: none
- Scope: `{ ownerId }` or `{ any: true }`
- Result: the todos in scope left, possibly none
- Guarantee: the delete and the read are one batch, which D1 runs as
  one transaction, so the list returned is exactly what the delete
  left. A retry deletes nothing more and returns the same list.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 2 statements. Reads the owner's rows to delete
  the completed ones, then reads the owner's rows left, each by the
  index on `user_id`.
- Rules: `todos.order`, `todos.scoped`
