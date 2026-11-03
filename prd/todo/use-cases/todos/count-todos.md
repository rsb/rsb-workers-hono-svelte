# Count todos

## Intent
Say how many todos are active and how many are completed, across the
whole list.

## Serves
From `prd/todo.md`:
- Functionality › Counter: "Displays the number of active todos".
- Functionality › Clear completed button: "Should be hidden when there
  are no completed todos."
- Deviations 5 and 6: on `/active` and `/completed` the counts come
  from here, so they reflect every todo, not only those listed.
- Scenarios 3.3–3.5, 7.1 and 8.7.

## Input
None.

## Rules
- Every todo is counted, whatever the page is showing.
- No todos at all is two zeros, not a failure.

## Holds together
Both counts are read in one statement, so they always describe the
same moment and add up to the size of the list then.

## Effects
None. It changes nothing.

## Result
The number of active todos and the number of completed todos.

## Failures
- The database fails: `internal`.
