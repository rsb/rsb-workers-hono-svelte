# Remove a todo

## Intent
Remove one todo for good.

## Serves
From `prd/todo.md`:
- Functionality › Item 3: "Hovering over the todo shows the remove
  button (`.destroy`)", as changed by deviation 11.
- Scenarios 5.1 and 5.2.

## Input
Which todo, by id.

## Rules
- Only that todo is removed.
- Removing a todo that is not there, including one already removed, is
  refused, not ignored.

## Holds together
One statement. If two removes of the same todo race, one removes it
and the other finds nothing to remove.

## Effects
The todo is deleted from the database. There are no external effects.

## Result
The id of the todo removed.

## Failures
- No todo has that id: `not_found`.
- The database fails: `internal`. Whether the todo was removed is not
  known to the caller.
