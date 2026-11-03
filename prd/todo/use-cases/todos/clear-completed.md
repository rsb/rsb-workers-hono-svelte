# Clear completed

## Intent
Remove every completed todo at once.

## Serves
From `prd/todo.md`:
- Functionality › Clear completed button: "Removes completed todos when
  clicked."
- Functionality › Mark all as complete: "Make sure to clear the checked
  state after the "Clear completed" button is clicked." The page works
  that out from the todos left.
- Scenarios 7.2 and 7.3.

## Input
An explicit statement that the completed todos are the ones to remove.

## Rules
- Only completed todos are removed; active ones stay.
- The request must say "completed". Without it, it is refused, never
  read as "remove all" (PRD, API rules).
- No completed todos is not a failure: the list comes back as it was.

## Holds together
The delete and the read of what is left are one transaction, so the
list returned is exactly what the delete left. A todo completed
concurrently is either completed before the transaction, and removed,
or after it, and listed as it was before.

## Effects
The completed todos are deleted from the database. There are no
external effects.

## Result
The todos left, in the order they were added.

## Failures
- The request does not say "completed": `validation`, on the field
  `completed`.
- The database fails: `internal`. Nothing is removed, since it is one
  transaction.
