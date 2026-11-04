# Change a todo

## Intent
Set one todo's title, whether it is completed, or both.

## Serves
- `prd/todo.md` › Functionality › Item 1 (completing a todo and back)
  and › Editing, as evidence of the need. Their wording ("clicking the
  checkbox", "on both blur and enter", "`.trim()`") belongs to the
  deliveries' specs, not here.
- Deviations 7 and 19; scenarios 3.1, 3.2 and 4.2–4.7.

## Input
- An id: which todo.
- A `TodoPatch`: a title, a value for `completed`, or both. Assumes
  `patch.nonempty`, `title.length`.

## Given
- `todo.exists`

## Effects
The todo is stored as changed. Each field given is set to the value
given, never flipped, so sending it twice is safe, and setting a value
the todo already has is not a failure. A field not given is left as it
is. No external effects.

## Result
The todo as it now is.

## Refused
- `todo.exists` does not hold: `not_found`. Nothing is changed.
- The store fails: `unavailable` or `server`. Whether the change was
  stored is not known to the caller.

## Guarantees
none

## Atomic
The change and the read of the todo as changed are one step, so the
todo returned is the one written. Two changes that race are applied one
after the other, and each field ends with the last value written to it.
There are no versions and no locks across requests (PRD, Out of scope).
