# Clear completed

## Intent
Remove every completed todo at once.

## Serves
- `prd/todo.md` › Functionality › Clear completed button, as evidence
  of the need. Its wording ("when clicked", "hidden") belongs to the
  deliveries' specs, not here.
- Scenarios 7.2 and 7.3.

## Input
none

## Given
none

## Effects
Every completed todo is deleted; active ones stay. No completed todos
is not a failure: nothing is deleted. No external effects.

## Result
The todos left.

## Refused
- The store fails: `unavailable` or `server`. Nothing is removed.
  shows: `todos.list.action_failed`

## Guarantees
- `todos.order`

## Atomic
The delete and the read of what is left are one step, so the list
returned is exactly what the delete left. A todo completed concurrently
is either completed before the step, and removed, or after it, and
listed as it was before.
