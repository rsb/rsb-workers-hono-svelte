# Feature: <the user's job, in their words>

<!--
A feature is one job a user does with the product, seen through the
views that do it. It is written in business terms and cites the layers
below it; it never restates a rule, a use case's promise or an api
shape. One file per feature, `prd/<product>/features/feature-<area>-<name>.md`.
Delete these comments when the file is written.
-->

Id: `<area>.<name>`
Area: `<area>`
Slice: <the slice that ships it, or "shipped, slice N">
Design: `design/<folder>/` (boards named `<view>.<state>.<viewport>.<theme>`)

## Purpose
A short description: what the user gets done, and what this feature is not.

## Who
Which actors may use it, as `access.md` says: `anonymous`, `member`,
`verified_member`, `admin`. One line per view if they differ.

## Views
One subsection per view. A view is one composition of behaviour; a
state is what the chain produces for it; a board is a view at one
state under one viewport and theme (not listed here; the design's
state enum is this table's mirror).

### `<area>.<view>`
What the view is for, in one line.

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `<area>.<view>.<state>` | one line, in the user's terms | one of the five forms below | `<view>.<state>`, or `not drawn` when the design has no board for it |

State ids are snake_case (`input_error`). A board name spells the view
and the state with hyphens for underscores, and nothing else changes:
`todos.list.input_error` → `list.input-error`.

`Produced by` takes one of five forms, and no other:
- `<use case> › <result | refused kind>`: what the chain returns
  (`add-a-todo › limit`).
- `bff`: the BFF alone, for pending, empty and the like.
- `<gate> › <result>`: a gate's result, where no use case runs
  (`authenticate › member`).
- `bff, over <source> › <kind>`: the BFF choosing a state over a result
  it is given (`bff, over the runner › forbidden`).
- `open: <slice> (…)`: nothing produces it yet; the slice that will, and
  why in a few words.

## Inputs
What the user types or picks, and the rule each one cites. The rule
owns the bound; this table only names it.

| Input | Field | Rules |
| --- | --- | --- |
| New title | `title` | `title.length` |

## Reads
What the view needs before it can render, and where it comes from.

| Read | Endpoint | Use case | Data cases |
| --- | --- | --- | --- |
| the list | `GET /todos` | list-todos | `todos.list` |

## Actions
What the user can do, and what runs.

| Action | Endpoint | Use case | Data cases | Leads to |
| --- | --- | --- | --- | --- |
| add | `POST /todos` | add-a-todo | `todos.add_unless_full` | `<area>.<view>.<state>` on success, `…` on `limit` |

## Budget
What one visit costs, as the budgets tests assert it: api calls per
page load, statements per call. Numbers, not adjectives.

## Done
The acceptance scenarios that prove the feature, through the BFF, each
citing the PRD line or deviation it comes from. Numbered.

A feature written ahead of its slice writes one line here, naming the
slice: "None yet. Slice B writes the scenarios."

## Board map
Only for a design exported before the naming convention: each export
file and the board it is, `<view>.<state>.<viewport>.<theme>`. The map
is complete both ways: every file is a board or says what else it is,
and every state above has a board or says `not drawn`. A design made
from `design/_templates/design-brief.md` names its boards by the
convention and needs no map; leave this section out.
