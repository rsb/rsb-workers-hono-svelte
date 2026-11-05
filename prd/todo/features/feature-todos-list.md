# Feature: keep a list of things to do

Id: `todos.list`
Area: `todos`
Slice: shipped, slices 2 to 8
Design: `design/2026-11-02-ui/` (boards named before the convention:
`desktop-light-list.png` is `list.default.desktop.light`; see the map
at the end)

## Purpose
A person keeps one list of todos: adds them, ticks them off, edits or
removes them, clears the finished ones, and looks at all, the active
or the completed ones. It is not shared, not ordered by hand, and not
larger than 500 items.

## Who
`member`, scope `own`: a person sees and changes only their list.
(Before slice A every request was the one implicit user; this line is
what slice A makes true.)

## Views

### `todos.list`
The one page of the app: the input at the top, the list, the footer
with the counter, the filters and the clear button.

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `todos.list.empty` | no list and no footer; a message points to the input, which has focus | list-todos › result, none | `list.empty` |
| `todos.list.default` | the todos in creation order; completed ones checked, struck through and dimmed; the counter; the filters; the clear button when any is completed | list-todos › result; count-todos › result | `list.default` |
| `todos.list.editing` | one row replaced by an input holding its title, focused; the other controls of that row hidden | bff (no chain runs until save) | `list.editing` |
| `todos.list.input_error` | the input keeps what was typed and shows "Title must be 1 to 256 characters" | add-a-todo › refused `title.length`; change-a-todo › refused `title.length` | `list.input-error` |
| `todos.list.full` | the list at 500; adding is refused and the page says the list is full, with the number from the reply | add-a-todo › refused `limit` | `list.full` |
| `todos.list.unavailable` | the page says the list cannot be reached right now | any use case › refused `unavailable` or `server` | not drawn; reuse the error view when it exists |

Filters are not states: `/`, `/active` and `/completed` render
`todos.list.default` or `todos.list.empty` over a filtered read.

## Inputs

| Input | Field | Rules |
| --- | --- | --- |
| New title | `title` | `title.length` |
| Edited title | `title` | `title.length`; an empty edit removes the todo (Functionality › Editing) |
| Filter | `completed` | wire rule in `api.md`; not an id here |

## Reads

| Read | Endpoint | Use case | Data cases |
| --- | --- | --- | --- |
| the list, filtered | `GET /todos?completed=` | list-todos | `todos.list` |
| the counts | `GET /todos/counts` | count-todos | `todos.counts` |

## Actions

| Action | Endpoint | Use case | Leads to |
| --- | --- | --- | --- |
| add | `POST /todos` | add-a-todo | `default`; `input_error`; `full` |
| toggle one | `PATCH /todos/:id` | change-a-todo | `default` |
| edit title | `PATCH /todos/:id` | change-a-todo | `default`; `input_error` |
| remove | `DELETE /todos/:id` | remove-a-todo | `default` or `empty` |
| mark all | `PATCH /todos` | mark-all-completed | `default` |
| clear completed | `DELETE /todos?completed=true` | clear-completed | `default` or `empty` |

## Budget
One page load: 2 api calls (`/active` and `/completed` the same),
each 1 statement. One mutation: 1 api call, 1 statement, then the
page reloads its reads. Recorded in the BFF budgets test.

## Done
The acceptance scenarios 2 to 8 in `prd/todo.md`, unchanged; they are
this feature's done criteria and move here when the root is thinned.

## Board map (first design, before the naming convention)
`desktop-light-empty` → `list.empty.desktop.light`;
`desktop-light-list`, `desktop-dark-list`, `mobile-light-list` →
`list.default.*`; `*-editing-a-row` → `list.editing.*`;
`*-input-error` → `list.input-error.*`; `*-list-full-500` →
`list.full.*`.
