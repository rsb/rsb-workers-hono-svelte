# Remove a todo

## Intent
Remove one todo for good.

## Serves
- `prd/todo.md` › Functionality › Item 3, as changed by deviation 11,
  as evidence of the need. Its wording ("hovering", "`.destroy`")
  belongs to the deliveries' specs, not here.
- Scenarios 5.1 and 5.2.

## Input
- An id: which todo.
- The actor's own scope, `{ ownerId }`, which the runner hands it as
  the operation's access row says (L43). Every todo below is one of the
  actor's.

## Given
- `todo.exists`
- `todo.owned`

## Effects
That todo is deleted; every other stays. No external effects.

## Result
The id of the todo removed.

## Refused
- `todo.exists` does not hold, including for a todo already removed:
  `not_found`. Nothing is removed.
  shows: `todos.list.default` or `todos.list.empty`: the todo is gone,
  as asked, so the page treats it as done
- `todo.owned` does not hold: `not_found`, the same answer as a missing
  todo, so whether another's todo has the id is not told. Nothing is
  removed.
  shows: `todos.list.default` or `todos.list.empty`, as for a missing
  todo: the two are not told apart
- The store fails: `unavailable` or `server`. Whether the todo was
  removed is not known to the caller.
  shows: `todos.list.action_failed`

## Guarantees
- `todos.scoped`

## Atomic
One step. If two removes of the same todo race, one removes it and for
the other `todo.exists` does not hold.
