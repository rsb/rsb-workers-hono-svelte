# Change a todo

## Intent
Change one todo's title, whether it is completed, or both.

## Serves
From `prd/todo.md`:
- Functionality › Item 1: "Clicking the checkbox marks the todo as
  complete by updating its `completed` value", and back again.
- Functionality › Editing: "The edit should be saved on both blur and
  enter" and "Make sure to `.trim()` the input and then check that
  it's not empty."
- Deviation 7 (title length). Deviation 19: an edit that is empty
  after trim never reaches this use case; the BFF keeps the title. If
  an empty title does arrive, it is refused.
- Scenarios 3.1, 3.2 and 4.2–4.7.

## Input
Which todo, by id, and at least one of: a new title, a new value for
`completed`.

## Rules
- A title follows the same rule as when adding: trimmed, then 1–256
  characters (deviation 7).
- `completed` is set to the value given, never flipped, so sending it
  twice is safe.
- Setting a value the todo already has is not a failure.
- What is not given is left as it is.

## Holds together
The change and the read of the todo as changed are one statement, so
the todo returned is the one written. Two changes that race are
applied one after the other, and each field ends with the last value
written to it. There are no versions and no locks across requests
(PRD, Out of scope).

## Effects
The todo is stored as changed. There are no external effects.

## Result
The todo as it now is.

## Failures
- Neither a title nor `completed` is given: `validation`, on the input
  as a whole.
- A given title or `completed` breaks its rule: `validation`, on that
  field.
- No todo has that id: `not_found`. Nothing is changed.
- The database fails: `internal`. Whether the change was stored is not
  known to the caller.
