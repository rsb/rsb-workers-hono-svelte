# Design brief: <feature or area>, <date>

<!--
The brief a Claude Design session starts from. Its job is to make the
design the visual twin of the feature documents: every board is a
view at one state, and the state list is the feature's. Fill it from
`prd/<product>/features/feature-<area>-*.md`; delete these comments.
-->

## What this design covers
The features, by id, and the views they contain:
- `<area>.<feature>`: views `<area>.<view>`, `<area>.<view>`

## Naming
- One component per view, named `<View>` (`SignIn`, `Users`).
- Its `state` prop is an enum whose values are exactly the feature's
  state list for that view, last segment only (`default`, `wrong`,
  `pending`, `empty`). No state the feature does not name; no state the
  feature names left out.
- One board per view × state × viewport × theme that the brief asks
  for, named with four segments in this order and nothing else:
  `<view>.<state>.<viewport>.<theme>` (`sign-in.wrong.desktop.dark`).
  A board's name parses back to its state id; the PNG exports sort by
  state. The canvas title may read `Sign in · Wrong · Desktop · Dark`.
- Viewports: `desktop` (1280 wide) and `mobile` (390 wide). Themes:
  `light` and `dark`. Not every state needs every variant; the brief
  says which.
- Shared tokens and patterns in one `app.css`; nothing per board.

## Views and states
For each view: what it is for, its state list with one line each (the
user's view of it), and which variants to draw.

### `<area>.<view>`
| State | The user sees | Variants |
| --- | --- | --- |
| `default` | | desktop + mobile, light + dark |
| `<state>` | | desktop light only |

## Inputs and their wording
The inputs the view holds and the message each problem shows, written
by the BFF (the delivery words the problem; the design shows the
words). Cite the rule ids so the wording and the rule stay paired.

## Constraints
Theme follows the system; motion off under `prefers-reduced-motion`;
every control keyboard-reachable with a visible focus ring; fonts
served by the BFF; nothing shown by colour alone.

## Out of scope
What the design must not invent: no states beyond the list, no flows
the features do not name, no copy for errors the chain cannot produce.
