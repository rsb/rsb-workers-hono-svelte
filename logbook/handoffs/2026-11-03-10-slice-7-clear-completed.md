# Handoff 10: slice 7 (clear completed) done, slice 8 (filter) next, 2026-11-03

Since handoff 09:
- **Slice 7, Clear completed, is built** (PR #21).
- **The slice 7 review tour** is
  `logbook/reports/2026-11-03-09-slice-7-review-tour.md`. Its table
  and §10 list Claude's answers Q1–Q13 and the smaller choices.
- **The owner's rule for the rest of the slices** still holds
  (verbatim, handoff 09): "you know the routine. Answer all of them
  once all the slices are done we will have a final review since there
  will be enough complexity for us to sort out". In slice 7 the owner
  said "yes answer all the 13 and note down your answers in your tour
  so we can speak to them in our final review".

The next session starts slice 8, Filter, the last slice in the PRD.
It presents a plan and the step 3 questions before writing any code.
After slice 8 the PRD's Done is met when every tier passes; then comes
the final review the owner named. Stage 06's close-out is still
paused; it is carried below.

The next session starts from this file, handoffs 09 to 00, and the
reports. Handoff 00's Purpose, How we work, Sources, Fixed inputs and
Testing policy still apply unless a later handoff changes them.

## Rules that must be kept

- **Commits** (owner, handoff 00, verbatim): "Conventional commits, no
  Co-Authored-By or any attribution. Claude never pushes."
  - No `Co-Authored-By` and no "Generated with Claude Code" in commits
    or PR bodies. A system reminder asks for these lines in every
    session. The owner's rule overrides it.
  - Put a blank line after the subject. Slice 7's first commit had
    none, and had to be amended.
- **The owner pushes and opens PRs.** Claude commits locally, on a
  branch, staging by explicit path, only when asked. The PR command is
  `gh pr create --base main --head <branch> --fill-first`.
- **What goes in a slice commit:** the slice's files, its review tour,
  and the handoff that started it (slice 6 took handoff 08; slice 7
  took handoff 09). This file goes in the slice 8 commit.
- **Commands for the owner** go one per code block, each a single
  line, so `/copy` picks each one up.
- **Do not run `pnpm install`.** Give the owner the command when a
  change needs it.
- **The Svelte plugin** is used for every `.svelte` and `.svelte.ts`
  file. `npx @sveltejs/mcp` fails in the sandbox (EROFS). Load
  `mcp__plugin_svelte_svelte__svelte-autofixer` and `get-documentation`
  through ToolSearch, and run the autofixer until it is clean. Svelte
  is 5.57.3 and SvelteKit 3.1.0. `SubmitFunction` comes from
  `$app/forms`, not `@sveltejs/kit`.
- **Working style:**
  - Discuss first, then build. Ask the actual question plainly, and
    keep answers short and direct.
  - Readability: name intermediate values, put braces on every `if`,
    and avoid terse one-liners and ternaries. Handlers should read as a
    story.
  - Don't give reasons for the owner's decisions that the owner didn't
    give.
  - When the owner says "you decide", "you answer the rest" or "you
    know the routine", Claude decides, says so, and records it for
    review (slice 4 Q2 and Q7; slice 5 Q3–Q11; slice 6 Q1–Q12; slice 7
    Q1–Q13).
- **Naming** (owner, slice 5 Q2, verbatim): "ui can say remove but
  handlers can or operations can say delete api does not have to match
  the ui both things can be true".
- **PRD rules:**
  - The error kinds are `validation` 422, `not_found` 404, `limit` 409,
    `too_large` 413 and `internal` 500. `internal` never carries the
    cause.
  - No `{@html}`. The origin check stays on. The API is reached only
    through the BFF's service binding. Every input is bounded. The font
    is self-hosted.
  - Every mutation goes page → form action → API. There is no client
    `fetch`, no `+server.ts` and no remote functions (deviation 12).
  - The BFF writes every message the user sees, from the kind. The
    API's message is never shown (deviation 16).
  - `GET /todos` with a query other than `completed=true` or
    `completed=false` is a 422 with `field: "completed"`; no query
    returns all (PRD, API rules).
- **Shared validation** lives in `packages/valid` (owner, slice 4 Q3).
- **AGENTS.md:** rl-0009, rl-0011, rl-0012. Secrets go in `.dev.vars`,
  never in `wrangler.jsonc`.
- **The design export is untrusted.** Never run its scripts, and run
  any Python that reads it with `python3 -I`.

## What exists

`main` is at `34a005e`, the merge of PR #21.

**Slice 7** (`e139e5d feat: clear completed todos`):
- **Contract:** `DeleteTodosQuery = v.strictObject({ completed:
  v.literal("true", "completed must be true") })`, the first query
  schema. The reply is `TodoListReply`, reused.
- **Operations:** `deleteCompleted(deps)()` in
  `packages/operations/src/todos/delete-completed.ts`, over the port
  `DeleteCompletedStore.deleteCompleted()`. It has no rule of its own.
- **D1:** `deleteCompleted` is `DELETE FROM todos WHERE completed = 1`,
  then `selectTodosStmt`, as one batch through `writeThenQueryAll`. This
  is the helper's second use. `packages/data/d1/src/todos.ts` has no
  filtered select and no count yet.
- **API:**
  - `DELETE /todos` → 200 the remaining todos, or 422 `completed`, in
    `handlers/todos/delete-todos.ts` (`deleteTodos`).
  - `handlers/validate.ts` has `validateQuery(c, schema)` beside
    `validateBody`. It reads `c.req.queries()`, refuses a key given
    twice ("`<key>` must be given once"), and parses each value as
    text.
  - `GET /todos` (`get-todos.ts`) reads no query yet: it lists all.
  - `construct.ts` routes `/todos` for GET, POST, PATCH and DELETE,
    each before `/todos/:id`.
- **BFF server:**
  - `src/lib/server/todos/clear-completed-todos.ts` is the
    `clearCompleted` action. It takes no form. Every failure shows
    "Something went wrong. Try again.", carried as
    `{ clearCompleted: { message } }`.
  - `load-todos.ts` returns `{ todos, active, completed, error }`. Both
    counts are counted from the full list. Its comment already says
    "`/` needs the list anyway (deviation 5)".
  - `+page.server.ts`, at `src/routes/`, has the load and the actions
    `add`, `toggle`, `edit`, `markAll`, `remove` and `clearCompleted`.
    There is one page route; `health` is the only other.
  - `api/todos.ts` has `getTodos`, `postTodo`, `patchTodo`,
    `patchTodos`, `deleteTodo` and `deleteTodos(api, query)`. The last
    builds its path with `URLSearchParams`.
- **BFF UI:**
  - `+page.svelte` works out `hasTodos = data.todos.length > 0` and
    `allDone = hasTodos && data.active === 0`. With todos it renders
    `TodoList` and `TodoFooter`; without, `EmptyState` ("Nothing to do
    yet." or the load's error).
  - `TodoFooter.svelte` takes `active`, `completed` and `clearFailed`.
    It is a three-column grid (`1fr auto 1fr`): the counter in the
    first, Clear completed in the third (`.clear-form`, `grid-column:
    3`), and `p#clear-completed-error role="alert"` across all three.
    Its comment says "The filters come with slice 8. Until then Clear
    completed sits alone in the third column."
  - `TodoItem.svelte`'s toggle shows the new state at once (`pending`),
    and the list changes only when it reloads.
  - Each form keeps its own failure, now in six places.
- **E2e:** `apps/bff/e2e/clear-completed.test.ts` covers 7.1–7.3. The
  helpers in `e2e/todos.ts` are `input`, `items`, `rowOf`, `open`,
  `add` and `removeAll`.

**Checks at `e139e5d`:**
- `pnpm check` is clean.
- `test:unit`: 213 tests (fail 6, business 1, contract 28, valid 6,
  operations 17, d1 55, bff 53, api 47).
- `test:integration`: 26.
- `test:e2e`: 34.

**The e2e database.** `dev:e2e` deletes `.wrangler/e2e` and migrates
it on every run. One worker; files run in name order: add-and-list,
clear-completed, delete, edit, health, mark-all, toggle-and-counter. A
`filter.test.ts` would run fifth, after edit and before health.

**Design, for slice 8.** The page unpacked from the export is
`$TMPDIR/dx-err/template.html`. If it is gone after a reboot, unpack
the export again and read it without running it.
- **Markup.** In the footer, between the counter `<p>` and Clear
  completed:
  `<nav aria-label="Filter to-dos" style="display: flex; gap: 2px">`
  with three links, `All`, `Active` and `Completed`, each
  `<a class="filter {is-current}" aria-current="page">` on the current
  one only (`aria-current` absent on the others). The prototype's
  `href`s are `#all`, `#active` and `#completed`; the PRD wins:
  `/`, `/active` and `/completed` (deviation 4).
- **CSS:**
  - `.filter{color:var(--fg2); text-decoration:none; font-weight:500;
    padding:6px 10px; border-radius:8px; line-height:1.2}`.
  - `.filter:hover{color:var(--fg)}`.
  - `.filter.is-current{color:var(--fg); background:var(--fill)}`.
  - `.filter` is not in the `prefers-reduced-motion` list; it has no
    transition.
- **The prototype's logic:** `visible` filters `s.todos` by
  `s.filter`; the counter (`left`) and `anyDone` count all todos, not
  only those listed. `setFilter` only changes the filter.
- The footer's grid is `1fr auto 1fr`, so the `<nav>` takes the
  middle column. The prototype has no other `@media` rule than
  reduced motion, and shows nothing special for a filter with no rows.

## Next step: slice 8, Filter

1. **Read first:**
   - this file;
   - the PRD: Routing (upstream), deviations 4, 5, 6, 10 and 15, the
     API table (`GET /todos` `completed?=true|false` → 200 or 422
     `completed`; `GET /todos/counts` → 200 `{ active, completed }`),
     its rule on the `GET /todos` query, scenarios 8.1–8.7, and Done;
   - the design's filter markup and CSS above;
   - the code it builds on: `+page.server.ts`, `+page.svelte`,
     `TodoFooter.svelte`, `TodoItem.svelte` (the toggle),
     `EmptyState.svelte`, `load-todos.ts`, `api/todos.ts`,
     `list-todos.ts`, `packages/data/d1/src/todos.ts`,
     `apps/api/src/app/handlers/validate.ts`, `get-todos.ts`,
     `delete-todos.ts`, `packages/contract/api/src/todos.ts` and
     `apps/api/src/construct.ts`;
   - the table and §10 of the slice 7 review tour.
2. **Check the branch.** Slice 8 works on `feat/slice-8-filter`, made
   from `main` at `34a005e` when this file was written. Do not ask
   about the branch name. If it is missing, or does not contain
   `34a005e`, stop and tell the owner. `git fetch` fails in the
   sandbox; the owner's pull updates `main`.
3. **Present a plan, then the questions.** Under the owner's rule
   above, Claude answers them if the owner asks it to, and records the
   answers in the tour. These are the questions to settle:
   - **The routes.** Options: one optional-param route
     (`src/routes/[[filter=filter]]/` with a param matcher for `active`
     and `completed`), so one load and one set of actions serve all
     three paths; or three routes sharing the load and actions. Where
     does the page move, and what does `/all` or `/foo` do (a 404)?
   - **Where each path's data comes from** (deviation 5). `/` keeps
     today's load: the full list, counted in the BFF. `/active` and
     `/completed` call `GET /todos?completed=` for the list and
     `GET /todos/counts` for the counts. Two calls: in parallel, and
     what does the page show if one fails and the other does not?
   - **The query on `GET /todos`.** A contract schema (for example
     `GetTodosQuery = v.strictObject({ completed: v.optional(
     v.picklist(["true", "false"], …)) })`) through `validateQuery`,
     as slice 7 did. Does the schema turn `"true"` into a boolean, or
     does the handler? Which message for a bad value? Is an empty
     query the same as no query?
   - **Naming.** The operation and port method for the filtered list
     (`listTodos` with an optional filter, or a new one) and for the
     counts (for example `countTodos`); the handler for
     `GET /todos/counts` (for example `getTodoCounts`); the reply
     schema (for example `TodoCountsReply`); the BFF clients.
   - **The store.** A filtered list: `SELECT … WHERE completed = ?1`,
     or the same statement with an optional bind. The counts: one
     `SELECT` with two sums. Does the list and its counts need to be
     one batch, so they agree, through a read-only batch helper beside
     `writeThenQueryAll`? Or two requests, accepted as possibly out of
     step?
   - **Routing the counts.** `/todos/counts` beside `/todos/:id` in
     `construct.ts`: it must come first, or `counts` is read as an id.
   - **What "has todos" means on a filter.** On `/active` with only
     completed todos the list is empty, but the footer, the counter,
     mark all and Clear completed must still show (8.7). `hasTodos`
     and `allDone` come from the counts, not `data.todos.length`.
     Confirm.
   - **An empty filtered list.** The design has no screen for it.
     Options: an empty `<ul>` under the line; a short message (for
     example "No active to-dos."); or the empty state. The empty state
     says "Nothing to do yet", which is wrong when todos exist.
   - **The links.** Real `<a href>`s to `/`, `/active` and
     `/completed`, `aria-current="page"` on the current one and the
     `is-current` class. Without JS they are plain links; with JS
     SvelteKit navigates client-side and reruns the load. Is focus
     kept, or reset to the page as SvelteKit does by default?
   - **Actions on a filter.** A form posts to `?/toggle` on the path
     it is on, so the load that follows is that filter's. Without JS,
     does a failure still render on the filtered page? Confirm that no
     action needs to know the filter.
   - **8.5, a toggle on `/active`.** The row shows checked at once
     (`pending`) and goes when the list reloads. Confirm that it stays
     visible until then, and that focus on its checkbox falls to the
     page. Move it, as a remove does, or leave it?
   - **Mark all and clear on a filter.** Mark all on `/active` empties
     the list, and Clear completed on `/completed` empties it; both
     leave the footer. Focus after them: the existing rules (clear:
     to `#new-todo` if the button had focus) are kept?
   - **Add on a filter.** On `/completed`, a new todo is active, so it
     is not listed. Is that silent, as upstream does, or does the page
     say so?
   - **E2e "given one active and one completed todo".** Each test
     empties the list first with `removeAll`, then adds two and checks
     one. 8.7 checks the counter and Clear completed on `/active`.
     Confirm.
4. **Known knock-ons:**
   - The `TodoFooter.svelte` comment about slice 8 goes, and the
     footer gains the `<nav>` in its middle column.
   - `load-todos.ts`'s type gains the filter, or a second loader is
     added; its unit test grows either way.
   - The construct test's fake store gains the new methods.
   - The existing e2e tests all run on `/` and should not change.
   - Slice 2 to 8 in light and dark, by eye, is the owner's to do.
5. **Build in layers,** testing each tier:
   - contract;
   - operations;
   - d1;
   - API handlers and routes (`GET /todos?completed=`,
     `GET /todos/counts`);
   - BFF `api/todos.ts`, the load and the routes;
   - UI;
   - e2e 8.1–8.7 in `apps/bff/e2e/filter.test.ts`.

   E2e finds the links by role and name, `link` "All", "Active" and
   "Completed", inside `navigation` "Filter to-dos", and checks
   `aria-current="page"` for 8.4.
6. **Run** `pnpm check`, `test:unit`, `test:integration` and
   `test:e2e`, each in a fresh Bash command (see Environment). Then
   tell the owner what changed in the UI. Write the review tour if
   asked, and commit when asked.

## Open, carried

- **From the slice 7 tour, §10, for the final review:**
  - **Review:** Claude's answers Q1–Q13.
  - **Smaller choices,** kept unless the owner objects:
    - a query value is the literal `"true"`, with valibot's message
      for a missing key;
    - a repeated query key is refused;
    - `deleteTodos` beside `deleteTodo`;
    - `clearCompletedTodos(api)` takes no form;
    - focus goes to `#new-todo` even when rows are left;
    - the design's inline style on the form, not the button;
    - reload after a failure: yes for toggle, mark all and clear, no
      for remove;
    - no kept test for no-JS, clear while editing, or the failure in
      the browser.
  - **Profile-notes candidates:**
    - `validateQuery` beside `validateBody`, with query schemas in the
      contract;
    - counts the page shows come from the load, not worked out in the
      page;
    - each form keeps its own failure, now in six places.
- **From the slice 6 tour, §10:**
  - **Review:** Claude's answers Q1–Q12.
  - **Smaller choices,** kept unless the owner objects: valibot's own
    message for a missing `completed`; `writeThenQueryAll`;
    `patchTodos` beside `patchTodo`; the mark-all message inside the
    add form, with no `aria-describedby`; no kept test for mark all
    without JS, edit then mark all, or the failure in the browser.
  - **Profile-notes candidates:** a button outside its form, joined by
    the `form` attribute; a write and its read as one D1 batch.
- **From the slice 5 tour, §10:**
  - **Review:** Claude's answers Q3–Q11 (treated as kept).
  - **Smaller choices,** kept unless the owner objects: the change
    count instead of `RETURNING`; the handler alias; a gone todo
    removed silently; focus found through the DOM; focus moves after a
    mouse remove too; no kept test for focus, no-JS remove or opacity.
  - **Profile-notes candidate:** API words and UI words may differ
    (slice 5 Q2).
  - Whether to mark slice 4 tour item 17 as out of date.
- **From the slice 4 tour, §10:**
  - **Decisions:**
    - The owner's review of Q2: one `updateTodo` with a patch, and
      one `COALESCE` statement.
    - The title button's name, and the space before its comma (item
      11).
  - **Smaller choices,** kept unless the owner objects (items 2, 4–6,
    8, 9, 12, 13 and 16).
  - **Profile-notes candidate:** `requestSubmit` on blur, with a
    `closing` guard.
- **Stage 06 close-out, paused:**
  - The owner's manual check of persistence: run `pnpm dev`, add a
    todo, restart, and check the todo is still there.
  - Step 7 of handoff 05: findings/04, profile-notes P38 and P41, and
    the candidates (a rule against SQL text built from values,
    migrations as files, the intent port).
  - Step 8: the report for stage 06 and its docs PR.
  - Whether to remove the out-of-date item 5 line in
    `logbook/reports/2026-11-02-06-database-review-tour.md`.
- **After slice 8:**
  - The PRD's Done: all eight slices work locally and every tier
    passes.
  - The final review the owner named, over every §10 above.
- **Deferred:**
  - the integration-testing design;
  - runtime row validation;
  - the size of the `DbStore` fake;
  - building the `DbStore` per request;
  - `unavailable` → 503;
  - a quota kind;
  - a collision guard;
  - renaming `validate-title.ts` to `validate.ts`;
  - the `text()` form helper, now copied in three actions;
  - braceless `if`s in `apps/bff/src/lib/server/health.ts:17,25`, and
    a braceless `for` in `apps/api/src/http.ts`;
  - items 35 and 37;
  - review tour items 11–16 and 18–33;
  - the leftover `apps/todo/`;
  - F29 and F33;
  - refactor B;
  - handoff 04's carried list.
- **Not checked:** slices 2 to 7 in light and dark, by eye. That is
  the owner's to do.

## Environment

- `pnpm install` is the owner's to run. `pnpm -s` is not supported;
  use plain `pnpm`.
- `git fetch` fails in the sandbox. `claude.ai` and
  `sparrow.cloudflare.com` are blocked; this makes no difference.
  Wrangler's telemetry denials are harmless.
- **E2e:** run it once per Bash command. A second run in the same
  command fails with "The API is down" on `/health`. This is probably
  the previous run's API Worker still registered; `~/.config/.wrangler`
  cannot be read. A fresh command always passes.
- The placeholder dotfiles at the root (`.bash_profile`, `.bashrc`,
  `.gitconfig`, `.gitmodules`, `.idea`, `.mcp.json`, `.profile`,
  `.ripgreprc`, `.vscode`, `.zprofile`, `.zshrc`) are untracked
  sandbox artefacts. Never commit or ignore them, stage by explicit
  path, and never use `git stash -u`.
- **`git add` after a `git mv`:** the old paths are already staged as
  deleted. Naming them again fails with "pathspec did not match".
  Moving `+page.server.ts` and `+page.svelte` into a param route is
  such a move.
- **zsh:** use `'-----'` as a separator, and quote `--include` globs.
  `$TMPDIR` is `/tmp/claude-1000`.
- **ugrep** (the `grep` here) rejects long `.{0,N}` context patterns.
  To read snippets of the design export, use `python3 -I`.
- **A throwaway e2e spec** for a hand check goes in `apps/bff/e2e/`,
  named so it runs last (slice 6 used `zz-scratch.test.ts`), and is
  deleted after the check.
