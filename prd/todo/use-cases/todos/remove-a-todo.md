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

## Given
- `todo.exists`: a todo has the id.

## Effects
That todo is deleted; every other stays. No external effects.

## Result
The id of the todo removed.

## Refused
- `todo.exists` does not hold, including for a todo already removed:
  `not_found`. Nothing is removed.
- The store fails: `unavailable` or `server`. Whether the todo was
  removed is not known to the caller.

## Guarantees
none

## Atomic
One step. If two removes of the same todo race, one removes it and for
the other `todo.exists` does not hold.
