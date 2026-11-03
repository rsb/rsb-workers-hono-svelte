# Review tour: slice 8 (Filter), api and BFF, 2026-11-03

Claude wrote this tour of slice 8 for the owner to review against the
code. It was written, not led live. The order is the api story's:
contract → operations → data → handlers and construct. Then the BFF:
server, then UI, then the tests.

The code toured is the working tree of `feat/slice-8-filter`, on
`34a005e`, before the slice 8 commit. The change is 32 files: 21
changed, 2 moved with `git mv` (and changed) and 9 new. That does not
count handoff 10 or this report.

Checks on that tree:
- `pnpm check` is clean.
- `test:unit`: 247 tests (fail 6, business 1, contract 36, valid 6,
  operations 20, d1 61, bff 60, api 57). Slice 7 ended at 213.
- `test:integration`: 29, up from 26.
- `test:e2e`: 41, up from 34.

Slice 8 is the PRD's last slice. With every tier passing, the PRD's
Done is met locally. The owner's look by eye in light and dark is still
to come (§9).

There is no decisions draft for this slice. "Why" cites the step 3
questions of
[handoff 10](../handoffs/2026-11-03-10-slice-7-clear-completed.md) as
Q1–Q14, in the order Claude put them to the owner. The owner said: "yes
answer all the 14 and note down your answers in your tour so we can
speak to them in our final review". So Q1–Q14 are Claude's, for the
final review.

| Q | Question | Answer |
|---|----------|--------|
| Q1 | The routes | One optional-param route, `src/routes/[[filter=filter]]/`, with the page and its server file moved in by `git mv`. Kit 3's matcher, in `src/params.ts`, takes only `active` and `completed`, so `/all` and `/foo` are SvelteKit's 404. The 404 is covered by the matcher's unit test, not by e2e |
| Q2 | Where each path's data comes from | `/`: the full list, counted in the BFF, as before. `/active` and `/completed`: `GET /todos?completed=` and `GET /todos/counts`, in parallel. If either fails, the page fails as a whole: no list, counts of 0, and "Something went wrong. Try again." in the empty state |
| Q3 | The query | `GetTodosQuery`. The schema keeps the value as text (`"true"` or `"false"`), and the handler turns it into a boolean. The message for a bad value is "completed must be true or false". A bare `?` is no query; `?completed=` is a 422 |
| Q4 | Naming | Query `GetTodosQuery`. Filter `TodoFilter = { completed?: boolean }`, taken by `listTodos(filter)` (operation and port). Counts `countTodos()`, with port `CountStore.countTodos()` and business type `TodoCounts`. Handler `getTodoCounts`, reply `TodoCountsReply`. BFF clients `getTodos(api, query?)` and `getTodoCounts(api)` |
| Q5 | The store | Two requests, not one batch: a list and its counts can briefly disagree. No read-only batch helper |
| Q6 | Routing the counts | `GET /todos/counts` comes before `/todos/:id` in `construct.ts`; a construct test pins it |
| Q7 | "Has todos" on a filter | `hasTodos = active + completed > 0` and `allDone = hasTodos && active === 0`, both from the load's counts |
| Q8 | An empty filtered list | Nothing special: an empty list, with the footer under it |
| Q9 | The links | Real `<a href>`s to `/`, `/active` and `/completed`, with `aria-current="page"` and `is-current` on the current one. Focus stays on the link and the page does not scroll (`data-sveltekit-reset="false"` on the `<nav>`; see item 12) |
| Q10 | Actions on a filter | Unchanged. Each form posts to `?/action` on the path it is on, so the load that follows is that filter's. No action knows the filter |
| Q11 | 8.5, a toggle on `/active` | The row shows checked until the list reloads, then goes. If focus was in the row, it moves as after a remove: the next row's title, else the previous row's, else `#new-todo` |
| Q12 | Mark all and clear on a filter | The existing rules: mark all keeps its button and focus; clear sends focus to `#new-todo` if its button had it |
| Q13 | Add on `/completed` | Silent, as upstream: the new todo is not listed there, the input clears and the counter goes up |
| Q14 | E2e "given" | Each test opens `/`, runs `removeAll`, adds "buy milk" and "walk dog", checks "buy milk", waits for "1 item left", then opens the path |

Each stop lists what was shown, why, and the points raised. "Raised"
means Claude's notes for the review, not agreed or changed. §10
collects them.

## 1. Contract and business (Q3, Q4)

**Shown.**
- `packages/contract/api/src/todos.ts`:
  - `GetTodosQuery` (line 53) is
    `v.strictObject({ completed: v.exactOptional(v.picklist(["true", "false"], "completed must be true or false")) })`.
  - `TodoCountsReply` (line 75) is `{ active, completed }`, each a
    whole number of 0 or more.
  - Both are exported from `index.ts`.
- `packages/business/src/todos/todo.ts` adds `TodoFilter` (line 20)
  and `TodoCounts` (line 23).

**Why.**
- Q3: a query's values are text, as in slice 7's `DeleteTodosQuery`.
  Turning text into a boolean is the handler's job at the boundary, so
  the BFF client's query type stays text, the same as the wire.
- The PRD's rule: "a query other than `completed=true` or
  `completed=false` is a 422 with `field: "completed"`; no query
  returns all".

**Raised.**
1. **`?completed=` is a 422, not "no filter".** The PRD names only "no
   query" as "all". An empty value is something else.
2. **`TodoFilter` and `TodoCounts` live in business,** beside `Todo`.
   They carry no rule. The port needs a name for them, and the API's
   own code should not import the wire types.

## 2. Operations (Q4)

**Shown.**
- `list-todos.ts`: the port is now
  `ListStore.listTodos(filter: TodoFilter)`. The operation passes the
  filter on. An empty filter keeps every todo.
- New `count-todos.ts`: the port is `CountStore.countTodos()`. The
  operation `countTodos({ dbStore })()` wraps a failure as "count
  todos".

**Why.** Q4: one list operation with a filter, not a second one. With
no filter it is the same call it was before.

**Raised.**
3. **The filter is required, not optional,** in the port and the
   operation. Each caller writes `{}` for "all", so no call reads as
   "all" by accident.

## 3. Data, D1 (Q5)

**Shown.** `packages/data/d1/src/todos.ts`:
- **Stmt:**
  - `selectTodosByCompletedStmt` (line 45) is
    `SELECT id, title, completed FROM todos WHERE completed = ?1 ORDER BY seq`.
  - `countTodosStmt` (line 51) is one `SELECT` with
    `COUNT(*) FILTER (WHERE completed = 0) AS active` and the same for
    `1`.
- **Raw:** each runs through `queryAll`, named "select todos by
  completed" and "count todos".
- **Outer:**
  - `listTodos(filter)` (line 165) uses the select-all when
    `completed` is absent, and otherwise binds 0 or 1.
  - `countTodos()` (line 186) reads the one row. If none comes back,
    it returns a server failure, "count todos: no row came back".
- `store.test.ts` lists the new method.

**Why.**
- Q5: each count and list has its own endpoint, so the two calls
  happen apart anyway. The PRD puts concurrency out of scope. A batch
  would need a read-only helper beside `writeThenQueryAll`, used by
  nothing else.
- `COUNT(*) FILTER` gives 0 on an empty table, where `SUM` gives
  `NULL`. The integration test proves D1 runs it.

**Raised.**
4. **Two statements, not one with an optional bind.** The select-all
   is unchanged, and still shared with the two batches.
5. **No index on `completed`.** The list holds at most 500 rows.
6. **The "no row" failure cannot happen in SQLite.** It stands in for
   a throw, since `row` is typed as possibly missing.

## 4. API handlers and construct (Q3, Q4, Q6)

**Shown.**
- `apps/api/src/app/handlers/todos/get-todos.ts`:
  - `validateQuery(c, GetTodosQuery)` gives a 422 through
    `userFailure`.
  - `toFilter` (line 13) turns `"true"` and `"false"` into
    `{ completed: true }` and `{ completed: false }`, and no value
    into `{}`.
  - It then lists and presents, as before.
- New `get-todo-counts.ts`, `getTodoCounts(countTodos)`: count (500 on
  failure), then `success` with `{ active, completed }`.
- `construct.ts`: `Operations` gains `countTodos`, and
  `GET /todos/counts` is routed right after `GET /todos` (line 71),
  before every `/todos/:id`. The doc comment on `constructRoutes` says
  why.

**Why.**
- Q6: a `GET /todos/:id` does not exist today, so `counts` would fall
  through to a 404, not be read as an id. The order still matters for
  any later `GET /todos/:id`, and costs nothing.
- `validateQuery` already refuses a repeated key (slice 7), so
  `?completed=true&completed=false` is a 422 here too.

**Raised.**
7. **`getTodoCounts` builds its reply field by field,** not by passing
   `TodoCounts` through. That keeps the wire shape explicit, as
   `presentTodo` does.

## 5. BFF server (Q1, Q2, Q10)

**Shown.**
- `apps/bff/src/lib/server/api/todos.ts`:
  - `getTodos(api, query = {})` (line 20) sends no `?` when the query
    is empty.
  - New `getTodoCounts(api)` (line 30).
- New `apps/bff/src/lib/filter.ts`:
  - `Filter` is `"all" | "active" | "completed"`.
  - `FilterSegment` is the two that have a path segment.
  - `toFilterSegment(segment)` gives the segment, or `undefined`.
  - It is shared by the matcher, the server and the footer.
- New `apps/bff/src/params.ts`:
  `export const params = defineParams({ filter: toFilterSegment })`.
- `load-todos.ts`:
  - `TodosPage` gains `filter`.
  - `loadAll` (line 28) is the old load.
  - `loadFiltered` (line 45) starts both calls, awaits them together,
    and returns `failedPage` if either failed.
  - `loadTodos(api, filter)` picks between them.
- `src/routes/+page.server.ts` and `+page.svelte` moved to
  `src/routes/[[filter=filter]]/`.
  - The load reads `params.filter ?? "all"`.
  - The actions are unchanged.

**Why.**
- Q1: one route means one load and one set of actions for all three
  paths.
- **SvelteKit 3 changed matchers.** They now live in one
  `src/params.ts` that exports `params` from `defineParams`, not one
  file per matcher under `src/params/`. A matcher returns the value, or
  `undefined` for no match. The handoff's `src/params/filter.ts` is
  the Kit 2 shape.
- Q2: a list with no counts, or counts with no list, cannot draw the
  page. Failing as a whole matches a failed load on `/`.
- Q10: a form's `action="?/toggle"` is relative, so on `/active` it
  posts to `/active?/toggle`. Kit then reruns that route's load with
  `filter: "active"`.

**Raised.**
8. **Deviation 5 reads "/ filters in the BFF".** On `/` there is
   nothing to filter, so the BFF only counts. Claude read the PRD that
   way.
9. **The matcher is a plain function, not a valibot schema.** Kit
   runs matchers in the browser as well. A function needs no import
   there.
10. **Without JS, a failure renders on the filtered page,** at
    `/active?/toggle`, as on `/` today. A reload there asks to post
    again, as it already did on `/`.

## 6. BFF UI (Q7–Q9, Q11–Q13)

**Shown.**
- **`+page.svelte`** (line 44): `hasTodos` and `allDone` come from
  `data.active + data.completed`. `TodoFooter` gets
  `filter={data.filter}`.
- **`TodoFooter.svelte`:**
  - The slice 8 comment is gone.
  - `links` (line 20) lists the three filters with their `href` and
    label.
  - `currentFor` (line 27) gives `"page"` or `undefined`.
  - `<nav aria-label="Filter to-dos" class="filters" data-sveltekit-reset="false">`
    (line 78) holds one `<a class="filter">` per link, with
    `is-current` and `aria-current` on the current one only.
  - CSS (line 124): `.filters` is `grid-column: 2; display: flex;
    gap: 2px`. `.filter`, `.filter:hover` and `.filter.is-current`
    take the design's values.
- **`TodoItem.svelte`:**
  - `focusAfterRemove` is renamed `focusAfterRowGone` (line 29) and
    moved above the toggle, which now uses it too.
  - The toggle's `SubmitFunction` (line 59) reads, before the request,
    whether focus is in the row and which row is next to it. After the
    reload it checks whether the row left the DOM (`!row.isConnected`).
    If it did and the row had focus, focus moves.
- **`TodoList.svelte`:** the doc on `todos` no longer says "at least
  one".
- The Svelte autofixer is clean on all four.

**Why.**
- Q7: on `/active` with only completed todos, the list is empty, but
  8.7 needs the counter and Clear completed.
- Q8: the design has no screen for it, and upstream shows none. "Nothing
  to do yet" would be false.
- Q9: the filter changes the list, not the page, so a jump to the top
  or a focus reset would lose the user's place. Kit 3 replaced
  `data-sveltekit-keepfocus` and `data-sveltekit-noscroll` with one
  `data-sveltekit-reset="false"`. The first e2e run warned about the
  old name.
- Q11: a checked row on `/active` leaves like a removed one, so focus
  follows the same rule. On `/` the row stays connected and nothing
  moves.
- Q12, Q13: no new rule is needed. The counter and mark all already
  come from the counts.
- The design's inline `display: flex; gap: 2px` on the `<nav>` moved
  into `.filters`, which also places it in the grid.

**Raised.**
11. **An empty filtered list shows nothing** but the line and the
    footer. Q8's other options were a short message or the empty
    state.
12. **Kit's docs advise against keeping focus on links.** Their reason:
    screen reader users expect focus to move after a navigation. Here
    the link stays, and the URL and `aria-current` change. The
    alternative is Kit's default, which resets focus to the body and
    scrolls to the top.
13. **Hovering a filter link preloads its data.** `app.html` sets
    `data-sveltekit-preload-data="hover"`, so a hover over Active or
    Completed makes both API calls before any click.
14. **The design's inline style is on the `<nav>`, moved into CSS.**
    Slice 7 put the clear button's inline style on its form (slice 7
    tour, item 11).
15. **Focus moves after a mouse toggle too,** if the row had focus.
    A click on the check focuses it in most browsers, as with remove
    (slice 5's choice).

## 7. Tests

**Shown.**
- **Unit:**
  - contract, 8: `GetTodosQuery` refuses `"yes"`, `""` and an unknown
    key, takes `{}`, and passes `"true"` and `"false"` through.
    `TodoCountsReply` reads both counts, and refuses a negative, a
    fraction and a missing count.
  - operations, 3: `listTodos` passes the filter on; `countTodos`
    gives the counts and wraps a failure.
  - d1, 6:
    - no `WHERE` and no bind for `{}`;
    - 1 or 0 bound for `true` and `false`;
    - a failure named "select todos by completed";
    - the counts row read, no row, and a failure named "count todos".
  - api, 10:
    - `get-todos.test.ts`, 7, through a Hono route: no query, a bare
      `?`, `true` and `false` as booleans, `yes` (with the message),
      an empty value, the key twice, and an unknown key.
    - `get-todo-counts.test.ts`, 2: success, and `internal` 500.
    - `construct.test.ts`, 1: both filters, no filter, a 422, and
      `/todos/counts` routed, on the fake store. The fake gains
      `countTodos`, and `listTodos` filters.
  - bff, 7:
    - two client tests (the query sent or left out, and the counts
      path);
    - `load-todos.test.ts`: four new filter cases (the two calls, the
      `completed=true` path, a failed list, failed counts);
    - `filter.test.ts`, 1: the matcher refuses `all`, `foo` and
      `Active`.
- **Integration:** new
  `apps/api/test/integration/todos-filter.test.ts`, 3, on real D1:
  - counts of 0 on an empty table;
  - both filters in order, no filter, and the counts with 1 active and
    2 completed;
  - a 422 for `completed=yes`.
- **E2e:** new `apps/bff/e2e/filter.test.ts`, 8.1–8.7. It runs 5th in
  name order. `open(page, path = "/")` in `e2e/todos.ts` now takes a
  path. The other files are unchanged.
  - 8.4 also moves from Active to Completed from the keyboard. It
    checks the URL, `aria-current`, the list, and that focus stays on
    the link.
  - 8.5 toggles from the keyboard and checks that the row goes, "0
    items left" shows, and focus is on `#new-todo`.
  - 8.6 checks the URL, the current link and the list after a reload.
- **Checked once, not kept.** These ran, then were deleted:
  - With JS off, on `/active`, checking "walk dog" posts to
    `/active?/toggle` and leaves only "buy milk", with "1 item left".
    The Completed link then goes to `/completed` and lists "walk dog".
  - A 404 e2e test for `/all` and `/foo` was written, then removed. The
    PRD says e2e runs exactly its scenarios, and the matcher's unit
    test covers it.

**Why.**
- Q14: the "given" waits for "1 item left" before it leaves `/`. The
  check shows at once (`pending`), but the counter changes only after
  the toggle is saved. Without that wait, the first run logged "Failed
  to fetch" in each filter test: the page left with the toggle's
  request still in flight. The tests passed anyway, but only by luck.

**Raised.**
16. No kept test for no-JS on a filter, a failed filtered load in the
    browser, or the 404.
17. **8.5 checks focus only when no row is left.** The next-row and
    previous-row cases rely on the remove's rule, which also has no
    kept test (slice 5 tour).

## 8. What the UI shows now

- The footer has All, Active and Completed in its middle. The current
  one is shaded.
- `/active` and `/completed` list only those todos. The counter, mark
  all and Clear completed still count every todo.
- On Active, a checked todo goes from the list once it is saved; on
  Completed, an unchecked one does.
- A filter with nothing to list shows an empty list with the footer.
- `/all` or any other path shows SvelteKit's 404 page.

## 9. Not done in this slice

- No findings file, and no profile-notes entries. Stage 06's close-out
  is still paused (handoff 10, "Open, carried").
- Not checked by eye in light and dark, here or in slices 2–7.
- No real API failure was made in the browser.
- The items carried in handoff 10 are unchanged.

## 10. Open for the owner, at the final review

### Review: Claude's answers
1. Q1–Q14, in the table at the top.

### Smaller choices, kept unless the owner objects
2. `?completed=` is a 422 (item 1).
3. `TodoFilter` and `TodoCounts` in business (item 2); the filter is
   required, `{}` for all (item 3).
4. Two select statements, not an optional bind; no index on
   `completed` (items 4–5).
5. The "no row" failure in `countTodos` (item 6).
6. `getTodoCounts` builds its reply field by field (item 7).
7. Deviation 5 read as "the BFF counts on `/`" (item 8).
8. The matcher is a plain function (item 9).
9. An empty filtered list shows nothing (item 11).
10. Focus kept on a filter link, against Kit's general advice
    (item 12).
11. Hover preloading of the filters left on (item 13).
12. The `<nav>`'s inline style moved into CSS (item 14).
13. Focus moves after a mouse toggle that hides the row (item 15).
14. No kept test for no-JS on a filter, a failed filtered load, or the
    404 in the browser (items 16–17).

### Candidates for profile-notes
15. SvelteKit 3 matchers: one `src/params.ts` with `defineParams`,
    whose matcher returns the value, or `undefined` for no match.
16. SvelteKit 3 link options: `data-sveltekit-reset="false"` replaces
    `keepfocus` and `noscroll`.
17. A page whose list is filtered takes "has any" from counts that
    cover everything, not from the list's length (Q7).
18. An e2e "given" waits for something that changes only after the
    server replies, not for the pending state.

### Housekeeping
19. Handoff 10 is untracked and goes in the slice 8 commit, with this
    report.
20. After this slice the PRD's Done is met locally. The final review
    over every §10 from slices 4 to 8 is next.
