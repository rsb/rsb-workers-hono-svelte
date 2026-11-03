# List todos

## Intent
Show the todos, all of them or only the active or the completed ones.

## Serves
From `prd/todo.md`:
- Functionality › New todo: "appends it to the todo list", so the list
  is in the order todos were added.
- Functionality › Routing: "When the route changes, the todo list
  should be filtered on a model level", as changed by deviations 4–6:
  `/active` and `/completed` ask for the filtered list, and `/` asks
  for the full one and filters it in the BFF.
- Scenarios 2.4, 2.8 and 8.1–8.3.

## Input
Optionally, whether the todos wanted are completed or active. Without
it, every todo.

## Rules
- The todos come in the order they were added.
- With the filter, only the todos whose `completed` matches it.
- The filter is only ever completed or active. Anything else is
  refused, never read as "all".

## Holds together
One read. The list is a consistent snapshot of the database at one
moment; it cannot mix the state before and after a concurrent write.

## Effects
None. It changes nothing.

## Result
The todos, possibly none.

## Failures
- The filter is neither completed nor active: `validation`, on the
  field `completed`.
- The database fails: `internal`.
