# Count todos

## Intent
Say how many todos are active and how many are completed, across the
whole list.

## Serves
- `prd/todo.md` › Functionality › Counter and › Clear completed button,
  as evidence of the need. Their wording ("displays", "hidden") belongs
  to the deliveries' specs, not here.
- Deviations 5 and 6: every todo is counted, whatever is listed.
- Scenarios 3.3–3.5, 7.1 and 8.7.

## Input
- The actor's own scope, `{ ownerId }`, which the runner hands it as
  the operation's access row says (L43). Every todo below is one of the
  actor's.

## Given
none

## Effects
None. It changes nothing.

## Result
The number of active todos and the number of completed todos, across
every todo. No todos at all is two zeros.

## Refused
- The store fails: `unavailable` or `server`.
  shows: `accounts.error.failed` (the page's load fails)

## Guarantees
- `todos.scoped`

## Atomic
Both counts are read in one step, so they describe the same moment and
add up to the size of the list then.
