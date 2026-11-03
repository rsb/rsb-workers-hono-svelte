# Mark all completed

## Intent
Make every todo completed, or every todo active, at once.

## Serves
From `prd/todo.md`:
- Functionality › Mark all as complete: "This checkbox toggles all the
  todos to the same state as itself."
- Deviation 20: it is a toggle button, pressed when every todo is
  completed. Whether it shows as pressed is the page's concern, worked
  out from the todos; scenarios 6.3 and 6.4 need nothing from here.
- Scenarios 6.1 and 6.2.

## Input
The value every todo's `completed` should take.

## Rules
- Every todo gets the value given. It is set, never flipped, so doing
  it twice is safe.
- No todos at all is not a failure: the list comes back empty.

## Holds together
The change and the read of the list are one transaction, so the list
returned is exactly what was written. A todo added concurrently is
either in the list with the new value or added after the change, never
listed with its old value.

## Effects
Every todo is stored as changed. There are no external effects.

## Result
Every todo as it now is, in the order they were added.

## Failures
- The value is missing or not true or false: `validation`, on the field
  `completed`.
- The database fails: `internal`. Nothing is changed, since it is one
  transaction.
