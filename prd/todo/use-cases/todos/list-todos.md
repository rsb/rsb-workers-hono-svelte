# List todos

## Intent
Read the todos: all of them, or only the active or the completed ones.

## Serves
- `prd/todo.md` › Functionality › New todo ("appends it to the todo
  list") and › Routing, as evidence of the need. Which page asks for
  which list belongs to the deliveries' specs, not here.
- Deviations 4–6; scenarios 2.4, 2.8 and 8.1–8.3.

## Input
- A `TodoFilter`: optionally, whether the todos wanted are completed.
  Without it, every todo.
- The actor's own scope, `{ ownerId }`, which the runner hands it as
  the operation's access row says (L43). Every todo below is one of the
  actor's.

## Given
none

## Effects
None. It changes nothing.

## Result
The todos whose `completed` matches the filter, or every todo without
one; possibly none.

## Refused
- The store fails: `unavailable` or `server`.
  shows: `accounts.error.failed` (the page's load fails)

## Guarantees
- `todos.order`
- `todos.scoped`

## Atomic
One read: the list is a snapshot of one moment, never a mix of the
state before and after a concurrent write.
