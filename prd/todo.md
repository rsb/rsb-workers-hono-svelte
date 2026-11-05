# PRD: todo

## Purpose
The lab app for the workers-hono-svelte profile. What it is for is the
way a request moves through the code, not the todo behaviour: each
slice is built to show where each file of a request sits (parts 1a–7)
and what of that a profile can state and a machine can check.
Behaviour is borrowed from TodoMVC so that none of it has to be
invented, and so that every acceptance scenario can cite the sentence
it comes from.

The app is also a pattern catalogue. Where the stack offers more than
one way to do the same thing, and the lab needs to compare them, the
app carries one example of each, on purpose. These pairs are recorded
in `logbook/profile-notes.md` as deliberate variants, not drift.

Once agreed, this file is frozen.

Since stage 22 the PRD is a tree (L44). This file keeps what is
product-wide; the rest lives beside it in `prd/todo/`:
`features/` (one per user job, with its views, states and acceptance
scenarios), `use-cases/<area>/` (one per operation), `rules.md`,
`api.md`, `access.md` (who may run each operation, L39, L43) and
`data/` (one file per database).

## Source and licence
Behaviour comes from the TodoMVC application specification,
`app-spec.md` lines 80–122 (the `## Functionality` section), at
`tastejs/todomvc@ff43b02e59dfa604386bb382034b2cd07c2bcd8a`. That text
is reproduced verbatim below under the following licence, from
`license.md` at the same commit:

> Everything in this repo is MIT License unless otherwise specified.
>
> Copyright (c) Addy Osmani, Sindre Sorhus, Pascal Hartig, Stephen Sawchuk.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of
> this software and associated documentation files (the "Software"), to deal in
> the Software without restriction, including without limitation the rights to
> use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
> the Software, and to permit persons to whom the Software is furnished to do so,
> subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
> FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
> IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
> CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The API's shape was informed by Todo-Backend
(`TodoBackend/todo-backend-js-spec@9fdf6f9`). It is cited only: that
repo has no licence, so nothing from it is reproduced.

## Functionality (verbatim upstream)
The section heading is replaced by this one (lines 82–122 follow) and
headings are demoted one level; nothing else is changed. Where the
app differs, see Deviations.

#### No todos

When there are no todos, `#main` and `#footer` should be hidden.

#### New todo

New todos are entered in the input at the top of the app. The input element should be focused when the page is loaded, preferably by using the `autofocus` input attribute. Pressing Enter creates the todo, appends it to the todo list, and clears the input. Make sure to `.trim()` the input and then check that it's not empty before creating a new todo.

#### Mark all as complete

This checkbox toggles all the todos to the same state as itself. Make sure to clear the checked state after the "Clear completed" button is clicked. The "Mark all as complete" checkbox should also be updated when single todo items are checked/unchecked. Eg. When all the todos are checked it should also get checked.

#### Item

A todo item has three possible interactions:

1. Clicking the checkbox marks the todo as complete by updating its `completed` value and toggling the class `completed` on its parent `<li>`

2. Double-clicking the `<label>` activates editing mode, by toggling the `.editing` class on its `<li>`

3. Hovering over the todo shows the remove button (`.destroy`)

#### Editing

When editing mode is activated it will hide the other controls and bring forward an input that contains the todo title, which should be focused (`.focus()`). The edit should be saved on both blur and enter, and the `editing` class should be removed. Make sure to `.trim()` the input and then check that it's not empty. If it's empty the todo should instead be destroyed. If escape is pressed during the edit, the edit state should be left and any changes be discarded.

#### Counter

Displays the number of active todos in a pluralized form. Make sure the number is wrapped by a `<strong>` tag. Also make sure to pluralize the `item` word correctly: `0 items`, `1 item`, `2 items`. Example: **2** items left

#### Clear completed button

Removes completed todos when clicked. Should be hidden when there are no completed todos.

#### Persistence

Your app should dynamically persist the todos to localStorage. If the framework has capabilities for persisting data (e.g. Backbone.sync), use that. Otherwise, use vanilla localStorage. If possible, use the keys `id`, `title`, `completed` for each item. Make sure to use this format for the localStorage name: `todos-[framework]`. Editing mode should not be persisted.

#### Routing

Routing is required for all implementations. If supported by the framework, use its built-in capabilities. Otherwise, use the  [Flatiron Director](https://github.com/flatiron/director) routing library located in the `/assets` folder. The following routes should be implemented: `#/` (all - default), `#/active` and `#/completed` (`#!/` is also allowed). When the route changes, the todo list should be filtered on a model level and the `selected` class on the filter links should be toggled. When an item is updated while in a filtered state, it should be updated accordingly. E.g. if the filter is `Active` and the item is checked, it should be hidden. Make sure the active filter is persisted on reload.

## Constraints
These are fixed for the lab. A deviation below cites one of them; a
deviation that cannot is dropped.
- **C-fixed** The fixed inputs of handoff 00: the envelope, the stack
  and shape, a store behind a port (in memory until stage 06, then D1,
  see Database), the API reachable only through the BFF's service
  binding, local only.
- **C-catalogue** The pattern catalogue (Purpose): where the lab
  compares two ways of doing one thing, both are built.
- **C-secure** Security and reliability are high priorities in the
  profile's patterns: every input the API accepts is bounded, and
  nothing a client sends can grow the API's memory without limit.
- **C-design** The design in `design/2026-11-02-ui/`: how the page
  looks, its wording, and the interactions its screens show. Each
  feature names its design and maps its boards; these lines hold for
  every page:
  - **Theme.** Light or dark follows the system setting
    (`prefers-color-scheme`); the page has no theme switch.
  - **Tokens.** One accent colour. The colours, type sizes and spacing
    are those of `todo-app.html`, defined once as CSS custom
    properties.
  - **Type.** Instrument Sans (SIL OFL 1.1), served by the BFF, never
    from a third-party host.
  - **Wording.** The heading reads "Todos"; the input placeholder
    reads "What needs doing?"; a single item is a "to-do" in labels
    and messages ("New to-do", "Edit to-do", "Remove ‘title’").
  - **Completion.** A completed todo is shown by the check, a
    strike-through and a dimmed title, never by colour alone. The
    check animates once when ticked.
  - **Motion.** Every transition and animation is off under
    `prefers-reduced-motion`.
  - **Focus.** Every control is reachable by keyboard and has a
    visible focus ring in the accent colour.
  - **Where the design's prototype differs** from this file on how the
    page is built (hash links, state held in the browser), this file
    wins: routes stay real paths (4) and every mutation stays a form
    action (12).
- **C-accounts** The app has accounts, built in slices A to E
  (`logbook/handoffs/2026-11-05-23-auth-slice-a.md`, L37–L43): every
  request acts for an actor, and every todo belongs to one user. The
  accounts design is `design/2026-11-03-ui-accounts/`, under C-design's
  lines.

## Deviations
One per line, each with its constraint.
1. Every API response uses the envelope (C-fixed).
2. The API is not public, so it has no CORS and no URL of its own
   (C-fixed).
3. Todos persist in the API's D1 database, run locally by wrangler,
   not localStorage. They survive a reload and a restart of the API
   Worker. The keys
   `id`, `title`, `completed` are kept; the `todos-[framework]` name
   does not apply (C-fixed).
4. Routes are real paths, `/`, `/active` and `/completed`, not hash
   routes, and Flatiron Director is not used. SvelteKit routing is the
   framework's built-in capability, which upstream prefers. The active
   filter persists on reload because it is the URL (upstream, Routing).
5. Filtering is done in two places on purpose: `/` filters in the BFF
   from the full list; `/active` and `/completed` ask the API for the
   filtered list and for the counts (C-catalogue).
6. The API has `GET /todos?completed=` and `GET /todos/counts`, which
   upstream has no need of (C-catalogue, for deviation 5).
7. A title is 1–256 characters after trim, counted as JS string length
   (UTF-16 code units). Upstream sets no limit (C-secure).
8. A request body over 8 KiB is rejected with `too_large` (413)
   (C-secure).
9. Each user's list holds at most 500 todos. Adding one more is
   rejected with `limit` (409) (C-secure). The check and the insert are
   one atomic step in every store (Database). Until slice A the 500 was
   for the one list; from A it is per user, since each user has their
   own (C-accounts).
10. DOM selectors (`#main`, `#footer`, `.destroy`, `<strong>`,
    `.editing`, `.completed`, `selected`) are not required. The
    behaviour each names is kept, and e2e finds elements by role,
    label and text. The counter's number is still emphasised.
11. "Hovering over the todo shows the remove button": the button is
    always in the DOM, and hover or keyboard focus within the row only
    changes its visibility, so it stays reachable by keyboard. On a
    device that cannot hover it is always visible (C-design). E2e
    hovers, then clicks it.
12. Every mutation goes page → form action → API. Client `fetch`,
    `+server.ts` endpoints and remote functions are not used in this
    iteration; they are a later one (C-catalogue, deferred).
13. `GET /health` exists (ours, C-fixed: it settles startup in slice 1).
14. The envelope has the kinds `internal`, `too_large` and `limit` in
    addition to `validation` and `not_found` (ours: `internal` for the
    error handler, the other two for deviations 8 and 9).
15. The page follows the design: its look, its layout at desktop and
    mobile widths, light and dark, and its empty state, which adds a
    message pointing to the input (C-design).
16. The page writes its own error text for each kind and never shows
    the API's message. A title outside 1–256 characters, including an
    empty one, reads "Title must be 1 to 256 characters"; the `limit`
    error reads "This list is full — it holds 500 to-dos. Clear
    completed or remove some to add more." The text appears under the
    input it belongs to, and the typed text is kept (C-design).
17. Pressing Enter on a focused title also starts editing, as well as
    double-clicking it (C-design).
18. While editing, only the remove button is hidden; the checkbox stays
    (upstream: "hide the other controls") (C-design).
19. Saving an edit that is empty after trim leaves editing and keeps
    the title unchanged; it does not destroy the todo (upstream: "If
    it's empty the todo should instead be destroyed") (C-design).
20. "Mark all as complete" is a toggle button with a pressed state, not
    a checkbox. It is pressed when every todo is completed, and is
    shown only when there are todos (C-design).
21. Every todo belongs to one user, and a person sees and changes only
    their own. A request with no live session acts for no one
    (`anonymous`): it reads no list and changes nothing, and the page
    says to sign in (C-accounts).
22. The envelope has the kinds `unauthenticated` (401) and `forbidden`
    (403), in addition to those of deviation 14. A `forbidden` error
    carries a `reason`: `account_disabled` when the session's user is
    disabled, `role` when the actor lacks what the operation requires
    (C-accounts).

## Design
The page's screens are the views and states of
`prd/todo/features/feature-todos-list.md`, which names its design and
maps its boards. The lines that hold for every page are C-design.

## API
`prd/todo/api.md`: every endpoint, its body, reply, errors and
examples, and how a use case's refusals map to the envelope's kinds.

## Envelope
- Success: `{ "ok": true, "data": <reply> }`.
- Error: `{ "ok": false, "error": { "kind": <kind>, "message": <text> } }`,
  plus `"field": <name>` when the kind is `validation`, and
  `"reason": <reason>` when the kind is `forbidden`.
- Kinds: `validation` (422), `unauthenticated` (401), `forbidden` (403),
  `not_found` (404), `limit` (409), `too_large` (413), `internal` (500)
  (deviations 14 and 22).
- An `internal` error never carries the cause in its message; the
  cause is logged.

## Security
Recorded here so that each slice keeps them. The threats and their
tests are `logbook/threats.md`.
- The page never renders a title as HTML: `{@html}` is not used.
- SvelteKit's origin check on form actions stays on; in SvelteKit 3 it
  is always on, with no trusted origin beyond the BFF's own.
- The API has no public route (C-fixed).
- The session cookie is `__Host-sid`: `Secure`, `HttpOnly`,
  `SameSite=Lax`, `Path=/`. Only the BFF writes it; the API never
  writes `Set-Cookie` (L40). Under `http://localhost` it is named `sid`,
  since a browser refuses a `__Host-` cookie without https; the name is
  one config value, and no code branches on the environment.
- A raw session token is never stored: the API keeps its SHA-256 hash
  (L40).
- The API checks the channel of every request that carries a cookie
  and changes something (L38), whatever SvelteKit has already checked.

## Shape
These are constraints, not rules.
- `apps/` holds the Workers: `api` (Hono on Cloudflare Workers) and
  `bff` (SvelteKit, Svelte 5, Cloudflare adapter). `packages/` holds
  what they build on: `contract/api` (the shapes and limits both
  share), `business`, `gates` (L37), `operations` and `data/*`, one per
  store.
- The BFF is the only public Worker. The API is reached only through a
  service binding.
- Local only. `pnpm dev` at the root runs both Workers with the binding
  between them.
- Errors on the request path are returned values, never thrown.
- The store is behind a port. D1 is the store the API runs on.

## Database
- D1, local only. Two databases, each bound on the API Worker (L42):
  the identity database, `IDENTITY_DB`, holds users and sessions; the
  app database, `APP_DB`, holds todos, each with its user's id. No
  query joins the two. The BFF reaches neither.
- SQL is written by hand, with `prepare` and `bind` only: no ORM, no
  query builder, and no value is ever put into SQL text.
- The schema is a set of numbered migration files, applied by
  wrangler.
- A multi-step write that must not interleave is atomic in every
  store. Each data package says how it achieves this.

## Slices
Each slice crosses contract, API and web and is tested at all three
tiers. The owner names each one when it starts; this is the order
planned.

| # | Slice | Upstream | Deviations |
|---|---|---|---|
| 1 | Health | ours | 1, 2, 8, 13, 14 |
| 2 | Add and list | New todo, No todos, Persistence | 3, 7, 9, 15, 16 |
| 3 | Toggle one and counter | Item 1, Counter | 10, 15 |
| 4 | Edit | Item 2, Editing | 7, 15, 16, 17, 18, 19 |
| 5 | Delete | Item 3 | 11, 15 |
| 6 | Mark all as complete | Mark all as complete | 15, 20 |
| 7 | Clear completed | Clear completed | 15 |
| 8 | Filter | Routing | 4, 5, 6, 15 |
| A | Ownership without login | ours | 9, 21, 22 |

Slice 2 was built before the design; it is restyled to the design
before slice 3 starts. The accounts slices are lettered, A to E
(C-accounts); B to E are named in handoff 23 and added here as each
starts.

## Acceptance scenarios
E2e runs these, through the BFF, with the scenarios under each
feature's Done. Each cites the upstream sentence, or the deviation, it
comes from.

### 1 Health
1. *Given* both Workers are running, *when* I open `/health`, *then* I
   see that the API is up. (13)

The page also shows the API as down when the binding call fails. That
case is not an e2e scenario, because `test:e2e` starts both Workers; it
is covered by slice 1's unit test of the page load, with a fake binding
that fails (a declared failure, so it belongs to that tier).

### 2 to 8
Moved to `prd/todo/features/feature-todos-list.md` › Done, with their
numbers: they are that feature's done criteria. Scenario 1 stays here:
health is a probe, not a user job.

## Done
Every slice in the table works locally, and the tests pass at every tier: unit,
integration, and end to end through the BFF. End to end runs scenario
1 above and every scenario under a feature's Done in
`prd/todo/features/`; this file keeps no copy of them.

## Out of scope
- Deploying, staging, production, a public site.
- Concurrency control beyond what each store's transactions settle
  (locks held across requests, retries, optimistic versions). An agent
  that introduces it is a finding, not a feature.
- Request paths other than form actions (deviation 12): a later
  iteration.

## Amendments
- 2026-10-31, stage 06: a D1 database replaces the in-memory store;
  transactions come into scope
  (`logbook/drafts/2026-10-31-06-database-decision.md`).
- 2026-11-02, UI design: the page follows the owner's design in
  `design/2026-11-02-ui/`. New constraint C-design, deviation 11
  widened, deviations 15–20, a Design section, the API rule on an
  empty edit, the slice table, and scenarios 2.1, 2.6, 2.7, 4.1, 4.5,
  4.7, 4.9, 6.1–6.4 and 7.3.
- 2026-11-05, stage 22: the PRD becomes a tree (L44). The Design
  section's product-wide lines move into C-design and the section
  points at the feature; the API section's table and rules move to
  `prd/todo/api.md`, which held every endpoint already; scenarios 2
  to 8 move under `prd/todo/features/feature-todos-list.md` › Done
  with their numbers; Done points at the features' Done sections. No
  line's meaning changes. The accounts features are written ahead of
  their slices; "Sign-in and users" leaves Out of scope in the
  amendment that starts slice A
  (`logbook/handoffs/2026-11-05-22-prd-tree.md`).
- 2026-11-05, stage 23, slice A: "Sign-in and users" leaves Out of
  scope, as stage 22's amendment said. New constraint C-accounts;
  deviation 9 is per user; deviations 21 and 22; the Envelope's two
  kinds and `reason`; Security's cookie, token and channel lines; Shape
  names `gates`; Database names both databases; the slice table gains
  A. `access.md` joins the tree
  (`logbook/handoffs/2026-11-05-23-auth-slice-a.md`).
