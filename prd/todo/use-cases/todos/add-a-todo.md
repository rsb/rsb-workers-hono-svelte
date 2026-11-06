# Add a todo

## Intent
Append a new, active todo to the list.

## Serves
- `prd/todo.md` › Functionality › New todo, as evidence of the need. Its
  wording ("pressing Enter", "`.trim()`") belongs to the deliveries'
  specs, not here.
- Deviations 7 and 9; scenarios 2.3–2.8.

## Input
- A `NewTodo`: a title. Assumes `title.length`.
- A fresh id from the id source (D13).
- The actor's own scope, `{ ownerId }`, which the runner hands it as
  the operation's access row says (L43). Every todo below is one of the
  actor's.

## Given
- `todos.cap`

## Effects
One todo is stored: active, with the given id, last in creation order.
No external effects.

## Result
The stored todo.

## Refused
- `todos.cap` does not hold: `limit`. Nothing is stored.
  shows: `todos.list.full`
- The store fails: `unavailable` or `server`. Whether the todo was
  stored is not known to the caller.
  shows: `todos.list.action_failed`

## Guarantees
- `todos.order`
- `todos.unique_id`
- `todos.scoped`

## Atomic
The count and the insert are one step: two adds at 499 cannot both
land (deviation 9).
