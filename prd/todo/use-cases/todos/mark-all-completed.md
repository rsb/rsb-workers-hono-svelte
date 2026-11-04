# Mark all completed

## Intent
Make every todo completed, or every todo active, at once.

## Serves
- `prd/todo.md` › Functionality › Mark all as complete, as evidence of
  the need. Its wording ("this checkbox toggles") belongs to the
  deliveries' specs, not here.
- Deviation 20; scenarios 6.1 and 6.2.

## Input
- A `Completed`: the value every todo's `completed` takes.

## Given
none

## Effects
Every todo's `completed` is set to the value given, never flipped, so
doing it twice is safe. No todos at all is not a failure. No external
effects.

## Result
Every todo as it now is.

## Refused
- The store fails: `unavailable` or `server`. Nothing is changed.

## Guarantees
- `todos.order`

## Atomic
The change and the read of the list are one step, so the list returned
is exactly what was written. A todo added concurrently is either in the
list with the new value or added after the change, never listed with
its old value.
