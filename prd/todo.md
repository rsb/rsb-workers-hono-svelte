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
9. The store holds at most 500 todos. Adding one more is rejected with
   `limit` (409) (C-secure). The check and the insert are one atomic
   step in every store (Database).
10. DOM selectors (`#main`, `#footer`, `.destroy`, `<strong>`,
    `.editing`, `.completed`, `selected`) are not required. The
    behaviour each names is kept, and e2e finds elements by role,
    label and text. The counter's number is still emphasised.
11. "Hovering over the todo shows the remove button": the button is
    always in the DOM, and hover only changes its visibility, so it
    stays reachable by keyboard. E2e hovers, then clicks it.
12. Every mutation goes page → form action → API. Client `fetch`,
    `+server.ts` endpoints and remote functions are not used in this
    iteration; they are a later one (C-catalogue, deferred).
13. `GET /health` exists (ours, C-fixed: it settles startup in slice 1).
14. The envelope has the kinds `internal`, `too_large` and `limit` in
    addition to `validation` and `not_found` (ours: `internal` for the
    error handler, the other two for deviations 8 and 9).

## API
All paths are on the `todo-api` Worker, reached through the BFF's `API`
binding. A todo is `{ id: string, title: string, completed: boolean }`.

| Route | Body or query | Success | Errors |
|---|---|---|---|
| `GET /health` | | 200 `{ ok: true }` (data) | |
| `GET /todos` | `completed?=true\|false` | 200 the todos, in creation order | 422 `completed` |
| `GET /todos/counts` | | 200 `{ active, completed }` | |
| `POST /todos` | `{ title }` | 201 the todo | 422 `title`; 409 `limit` |
| `PATCH /todos/:id` | `{ title?, completed? }`, at least one | 200 the todo | 422 field; 404 |
| `DELETE /todos/:id` | | 200 `{ id }` | 404 |
| `PATCH /todos` | `{ completed }` | 200 all todos | 422 `completed` |
| `DELETE /todos` | `completed=true` | 200 the remaining todos | 422 `completed` |

Rules that apply to every route:
- A title is trimmed, then must be 1–256 characters. The limit is
  defined once in the contract, and both the BFF and the API use it.
- A query on `GET /todos` other than `completed=true` or
  `completed=false` is a 422 with `field: "completed"`; no query
  returns all.
- `DELETE /todos` without `completed=true` is a 422 with
  `field: "completed"`, never "delete all".
- A body that is not JSON, or has unknown fields, is a 422.
- Any body over 8 KiB is a 413 `too_large`, before it is parsed.
- An unknown route is a 404 `not_found`.
- Editing a title to empty is a delete in the BFF (upstream, Editing);
  the API's PATCH rejects an empty title with a 422.

## Envelope
- Success: `{ "ok": true, "data": <reply> }`.
- Error: `{ "ok": false, "error": { "kind": <kind>, "message": <text> } }`,
  plus `"field": <name>` when the kind is `validation`.
- Kinds: `validation` (422), `not_found` (404), `limit` (409),
  `too_large` (413), `internal` (500).
- An `internal` error never carries the cause in its message; the
  cause is logged.

## Security
Recorded here so that each slice keeps them; none needs code of its
own beyond the limits above.
- The page never renders a title as HTML: `{@html}` is not used.
- SvelteKit's origin check on form actions stays on.
- The API has no public route (C-fixed).

## Shape
These are constraints, not rules.
- `apps/` holds the Workers: `api` (Hono on Cloudflare Workers) and
  `bff` (SvelteKit, Svelte 5, Cloudflare adapter). `packages/` holds
  what they build on: `contract/api` (the shapes and limits both
  share), `business`, `operations` and `data/*`, one per store.
- The BFF is the only public Worker. The API is reached only through a
  service binding.
- Local only. `pnpm dev` at the root runs both Workers with the binding
  between them.
- Errors on the request path are returned values, never thrown.
- The store is behind a port. D1 is the store the API runs on.

## Database
- D1, local only, through a `DB` binding on the API Worker. The BFF
  never reaches it.
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
| 2 | Add and list | New todo, No todos, Persistence | 3, 7, 9 |
| 3 | Toggle one and counter | Item 1, Counter | 10 |
| 4 | Edit | Item 2, Editing | 7 |
| 5 | Delete | Item 3 | 11 |
| 6 | Mark all as complete | Mark all as complete | |
| 7 | Clear completed | Clear completed | |
| 8 | Filter | Routing | 4, 5, 6 |

## Acceptance scenarios
E2e runs exactly these, through the BFF. Each cites the upstream
sentence, or the deviation, it comes from.

### 1 Health
1. *Given* both Workers are running, *when* I open `/health`, *then* I
   see that the API is up. (13)

The page also shows the API as down when the binding call fails. That
case is not an e2e scenario, because `test:e2e` starts both Workers; it
is covered by slice 1's unit test of the page load, with a fake binding
that fails (a declared failure, so it belongs to that tier).

### 2 Add and list
1. *Given* no todos, *when* I open `/`, *then* there is no list and no
   footer. ("When there are no todos, `#main` and `#footer` should be
   hidden.")
2. *Given* I open `/`, *then* the new-todo input has focus. ("The input
   element should be focused when the page is loaded")
3. *Given* no todos, *when* I type "buy milk" and press Enter, *then*
   the list shows "buy milk" and the input is empty. ("Pressing Enter
   creates the todo, appends it to the todo list, and clears the
   input.")
4. *Given* "buy milk", *when* I add "walk dog", *then* "walk dog" is
   below "buy milk". ("appends it to the todo list")
5. *When* I add "  buy milk  ", *then* the list shows "buy milk".
   ("Make sure to `.trim()` the input")
6. *When* I press Enter on an input of only spaces, *then* no todo is
   added. ("check that it's not empty before creating a new todo")
7. *When* I add a title of 257 characters, *then* no todo is added and
   I see why. (7)
8. *Given* "buy milk", *when* I reload, *then* "buy milk" is still
   there. (Persistence; 3)

### 3 Toggle one and counter
1. *Given* "buy milk", active, *when* I click its checkbox, *then* it
   shows as completed. ("Clicking the checkbox marks the todo as
   complete")
2. *Given* "buy milk", completed, *when* I click its checkbox, *then*
   it shows as active. (same sentence, the toggle)
3. *Given* one active todo, *then* the counter reads "1 item left".
   ("`1 item`")
4. *Given* two active todos, *then* it reads "2 items left". ("`2 items`")
5. *Given* one todo, completed, *then* it reads "0 items left".
   ("`0 items`")

### 4 Edit
1. *Given* "buy milk", *when* I double-click its title, *then* an input
   holding "buy milk" appears with focus and the checkbox and remove
   button are hidden. ("Double-clicking the `<label>` activates editing
   mode"; "hide the other controls and bring forward an input that
   contains the todo title, which should be focused")
2. *When* I change it to "buy oat milk" and press Enter, *then* the list
   shows "buy oat milk". ("The edit should be saved on both blur and
   enter")
3. *When* I change it to "buy oat milk" and click elsewhere, *then* the
   list shows "buy oat milk". (same sentence, blur)
4. *When* I change it to "  buy oat milk  " and press Enter, *then* the
   list shows "buy oat milk". ("Make sure to `.trim()` the input")
5. *When* I clear it and press Enter, *then* "buy milk" is removed.
   ("If it's empty the todo should instead be destroyed.")
6. *When* I change it and press Escape, *then* the list shows "buy
   milk". ("If escape is pressed during the edit … any changes be
   discarded.")
7. *When* I change it to 257 characters and press Enter, *then* the
   title is unchanged and I see why. (7)
8. *Given* I am editing, *when* I reload, *then* no todo is in editing
   mode. ("Editing mode should not be persisted.")

### 5 Delete
1. *Given* "buy milk" and "walk dog", *when* I hover over "buy milk"
   and click its remove button, *then* only "walk dog" is left.
   ("Hovering over the todo shows the remove button"; 11)
2. *Given* only "buy milk", *when* I remove it, *then* there is no list
   and no footer. ("When there are no todos … hidden.")

### 6 Mark all as complete
1. *Given* two active todos, *when* I check "Mark all as complete",
   *then* both are completed. ("This checkbox toggles all the todos to
   the same state as itself.")
2. *Given* two completed todos, *when* I uncheck it, *then* both are
   active. (same sentence)
3. *Given* two active todos, *when* I check each one, *then* "Mark all"
   is checked. ("When all the todos are checked it should also get
   checked.")
4. *Given* all completed and "Mark all" checked, *when* I uncheck one
   todo, *then* "Mark all" is unchecked. ("should also be updated when
   single todo items are checked/unchecked")

### 7 Clear completed
1. *Given* no completed todos, *then* "Clear completed" is not shown.
   ("Should be hidden when there are no completed todos.")
2. *Given* "buy milk" completed and "walk dog" active, *when* I click
   "Clear completed", *then* only "walk dog" is left. ("Removes
   completed todos when clicked.")
3. *Given* all completed and "Mark all" checked, *when* I click "Clear
   completed", *then* "Mark all" is not checked. ("Make sure to clear
   the checked state after the "Clear completed" button is clicked.")

### 8 Filter
1. *Given* one active and one completed todo, *when* I open `/active`,
   *then* only the active one is listed. ("`#/active`"; 4, 5)
2. *When* I open `/completed`, *then* only the completed one is listed.
   ("`#/completed`"; 4, 5)
3. *When* I open `/`, *then* both are listed. ("`#/` (all - default)")
4. *Given* I am on `/active`, *then* the "Active" filter link is marked
   as current, and no other is. ("the `selected` class on the filter
   links should be toggled"; 10)
5. *Given* I am on `/active`, *when* I check a todo, *then* it is no
   longer listed. ("if the filter is `Active` and the item is checked,
   it should be hidden.")
6. *Given* I am on `/completed`, *when* I reload, *then* I am still on
   `/completed` with the same list. ("Make sure the active filter is
   persisted on reload.")
7. *Given* I am on `/active`, *then* the counter and "Clear completed"
   reflect all todos, not only those listed. (Counter, Clear completed;
   5: they come from `GET /todos/counts`)

## Done
All eight slices work locally, and the tests pass at every tier: unit,
integration, and the acceptance scenarios above end to end through the
BFF.

## Out of scope
- Deploying, staging, production, a public site.
- Sign-in and users.
- Concurrency control beyond what each store's transactions settle
  (locks held across requests, retries, optimistic versions). An agent
  that introduces it is a finding, not a feature.
- Request paths other than form actions (deviation 12): a later
  iteration.

## Amendments
- 2026-10-31, stage 06: a D1 database replaces the in-memory store;
  transactions come into scope
  (`logbook/drafts/2026-10-31-06-database-decision.md`).
