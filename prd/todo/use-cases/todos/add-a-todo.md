# Add a todo

## Intent
Put a new, active todo at the end of the list.

## Serves
From `prd/todo.md`:
- Functionality › New todo: "Pressing Enter creates the todo, appends
  it to the todo list" and "Make sure to `.trim()` the input and then
  check that it's not empty before creating a new todo."
- Functionality › Persistence, as changed by deviation 3: the todo is
  kept in the database and survives a reload and a restart.
- Deviations 7 (title length) and 9 (at most 500 todos).
- Scenarios 2.3–2.8.

## Input
A title.

## Rules
- The title is trimmed, then must be 1–256 characters, counted as
  UTF-16 code units (deviation 7).
- A new todo is active, and gets a new id that no other todo has.
- It goes at the end of the list: lists are in the order todos were
  added.
- The list holds at most 500 todos. Adding to a full list is refused
  (deviation 9).

## Holds together
Counting the todos and inserting the new one are one atomic step. Two
adds that race when the list holds 499 cannot both land: exactly one
does, and the other is refused as full (deviation 9: "The check and
the insert are one atomic step in every store").

## Effects
The todo is stored. There are no external effects.

## Result
The new todo: its id, its title as trimmed, and `completed` false.

## Failures
- The title breaks its rule: `validation`, on the field `title`.
- The list is full: `limit`. Nothing is stored.
- The database fails: `internal`. Whether the todo was stored is not
  known to the caller.
