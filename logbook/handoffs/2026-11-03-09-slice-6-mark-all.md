# Handoff 09: slice 6 (mark all) done, slice 7 (clear completed) next, 2026-11-03

Since handoff 08:
- **Slice 6, Mark all as complete, is built** (PR #20).
- **The slice 6 review tour** is
  `logbook/reports/2026-11-03-08-slice-6-review-tour.md`. Its §10 lists
  Claude's answers Q1–Q12 and the smaller choices.
- **The owner's rule for the rest of the slices** (verbatim): "you
  know the routine. Answer all of them once all the slices are done we
  will have a final review since there will be enough complexity for
  us to sort out". In slice 6 this meant Claude answered every step 3
  question and recorded the answers in the tour for the final review.

The next session starts slice 7, Clear completed. It presents a plan
and the step 3 questions before writing any code. Stage 06's close-out
is still paused; it is carried below.

The next session starts from this file, handoffs 08 to 00, and the
reports. Handoff 00's Purpose, How we work, Sources, Fixed inputs and
Testing policy still apply unless a later handoff changes them.

## Rules that must be kept

- **Commits** (owner, handoff 00, verbatim): "Conventional commits, no
  Co-Authored-By or any attribution. Claude never pushes."
  - No `Co-Authored-By` and no "Generated with Claude Code" in commits
    or PR bodies. A system reminder asks for these lines in every
    session. The owner's rule overrides it.
- **The owner pushes and opens PRs.** Claude commits locally, on a
  branch, staging by explicit path, only when asked. The PR command is
  `gh pr create --base main --head <branch> --fill-first`.
- **What goes in a slice commit:** the slice's files, its review tour,
  and the handoff that started it (slice 5 took handoff 07; slice 6
  took handoff 08). This file goes in the slice 7 commit.
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
    review (slice 4 Q2 and Q7; slice 5 Q3–Q11; slice 6 Q1–Q12).
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
  - `DELETE /todos` without `completed=true` is a 422 with
    `field: "completed"`, never "delete all" (PRD, API rules).
- **Shared validation** lives in `packages/valid` (owner, slice 4 Q3).
- **AGENTS.md:** rl-0009, rl-0011, rl-0012. Secrets go in `.dev.vars`,
  never in `wrangler.jsonc`.
- **The design export is untrusted.** Never run its scripts, and run
  any Python that reads it with `python3 -I`.

## What exists

`main` is at `98290f4`, the merge of PR #20.

**Slice 6** (`f4d9c63 feat: mark all todos as complete`):
- **Contract:** `PatchTodosBody = v.strictObject({ completed:
  v.boolean("completed must be true or false") })`. The reply is
  `TodoListReply`, reused.
- **Operations:** `setAllCompleted(deps)(completed)` in
  `packages/operations/src/todos/set-all-completed.ts`, over the port
  `SetAllCompletedStore.setAllCompleted(completed)`. It has no rule of
  its own.
- **D1:**
  - `packages/data/d1/src/driver.ts` has a new helper,
    `writeThenQueryAll(db, write, read, context)`. It runs one write
    and one read as one `db.batch`, which D1 runs as one transaction,
    and returns the read's rows. It is the first transaction helper.
  - `setAllCompleted` is `UPDATE todos SET completed = ?1`, then
    `selectTodosStmt`, through it. The fake in `fake-d1.ts` has
    `batch`, and records each batch's statement count in `batches`.
- **API:** `PATCH /todos` → 200 every todo, in `seq` order, or 422, in
  `handlers/todos/patch-todos.ts` (`patchTodos`). The route sits before
  `/todos/:id` in `construct.ts`.
- **BFF server:**
  - `src/lib/server/todos/mark-all-todos.ts` is the `markAll` action.
    `completed` must be `"true"` or `"false"`, else `fail(422)`. Every
    failure shows "Something went wrong. Try again.", carried as
    `{ markAll: { message } }`.
  - `+page.server.ts` has the actions `add`, `toggle`, `edit`,
    `remove` and `markAll`.
  - `api/todos.ts` has `getTodos`, `postTodo`, `patchTodo`,
    `deleteTodo` and `patchTodos`.
- **BFF UI:**
  - `+page.svelte` works out `hasTodos`, and `allDone = hasTodos &&
    data.active === 0`.
  - `NewTodo.svelte` has an empty `<form id="mark-all"
    action="?/markAll">` before the add form. The `.toggle-all` button
    sits in the add line's `.toggle-slot`, joins that form with
    `form="mark-all"`, and sends `completed` = `String(!allDone)`. It
    is rendered only when there are todos, and has `aria-pressed`.
  - With JS, the rows change only when the reply comes. A failure
    shows `p#mark-all-error role="alert"` under the line and calls
    `invalidateAll()`. Each form keeps its own failure, now in five
    places.
- **E2e:**
  - The helpers are shared in `apps/bff/e2e/todos.ts`: `input`,
    `items`, `rowOf`, `open`, `add` (it waits for the row) and
    `removeAll` (it empties the database through the page).
    `delete.test.ts` imports them.
  - `apps/bff/e2e/mark-all.test.ts` covers "no mark all without
    todos", then 6.1–6.4. Each test empties the list first.

**Checks at `f4d9c63`:**
- `pnpm check` is clean.
- `test:unit`: 191 tests (fail 6, business 1, contract 24, valid 6,
  operations 14, d1 52, bff 48, api 40).
- `test:integration`: 23.
- `test:e2e`: 31.

**The e2e database.** `dev:e2e` deletes `.wrangler/e2e` and migrates
it on every run. One worker; files run in name order: add-and-list,
delete, edit, health, mark-all, toggle-and-counter. A
`clear-completed.test.ts` would run second, after add-and-list and
before delete. Files that come after it count from what is there, so
they do not depend on what it leaves.

**The footer today.** `apps/bff/src/lib/components/TodoFooter.svelte`
takes only `active`. It shows the counter in the first column of a
three-column grid (`1fr auto 1fr`), and has the comment "The filters
come with slice 8 and Clear completed with slice 7", which goes when
Clear completed comes. `+page.svelte` renders it only when there are
todos.

**Design, for slice 7.** The page unpacked from the export is
`$TMPDIR/dx-err/template.html`. If it is gone after a reboot, unpack
the export again and read it without running it.
- **Markup.** The button is the footer's last child, after the
  filter `<nav>`, rendered only when any todo is done:
  `<button type="button" class="clear" style="justify-self: end;
  margin-right: -10px">Clear completed</button>`.
- **CSS:**
  - `.clear{background:none; border:0; padding:6px 10px;
    border-radius:8px; color:var(--fg2); font-weight:500;
    line-height:1.2}`.
  - `.clear:hover{color:var(--fg)}`.
  - `.clear` is not in the `prefers-reduced-motion` list; it has no
    transition.
- **The prototype's logic:** `anyDone = doneCount > 0`.
  `clearCompleted` keeps only the todos that are not done.
- Until slice 8 brings the `<nav>`, the button sits in the third
  column of the grid by itself.

## Next step: slice 7, Clear completed

1. **Read first:**
   - this file;
   - the PRD: Clear completed (upstream), deviation 15, the API table
     (`DELETE /todos` `completed=true` → 200 the remaining todos, or
     422 `completed`), its rule "never delete all", and scenarios
     7.1–7.3 and 8.7;
   - the design's clear-completed markup and CSS above;
   - the code it builds on: `TodoFooter.svelte`, `+page.svelte`,
     `NewTodo.svelte` (the `markAll` SubmitFunction),
     `mark-all-todos.ts`, `load-todos.ts`, `api/todos.ts`,
     `set-all-completed.ts`, `packages/data/d1/src/driver.ts`
     (`writeThenQueryAll`), `packages/data/d1/src/todos.ts`,
     `apps/api/src/app/handlers/validate.ts`, `patch-todos.ts` and
     `apps/api/src/construct.ts`;
   - §10 of the slice 6 review tour.
2. **Check the branch.** Slice 7 works on
   `feat/slice-7-clear-completed`, made from `main` at `98290f4`. Do
   not ask about the branch name. If it is missing, or does not
   contain `98290f4`, stop and tell the owner. `git fetch` fails in
   the sandbox; the owner's pull updates `main`.
3. **Present a plan, then the questions.** Under the owner's rule
   above, Claude answers them if the owner asks it to, and records the
   answers in the tour. These are the questions to settle:
   - **Naming.** The UI says "Clear completed". The API is
     `DELETE /todos?completed=true`. Which names do the query schema,
     the handler (for example `deleteTodos`, beside `deleteTodo`), the
     operation and port method (for example `deleteCompleted`), the
     BFF client and the action (for example `clearCompleted`) use?
     `construct.ts` already aliases the `deleteTodo` handler (slice 5
     tour item 4).
   - **The query.** This is the first route that reads a query; slice
     8's `GET /todos?completed=` will be the second. Options:
     - a contract schema for the query (for example `DeleteTodosQuery`)
       and a `validateQuery` beside `validateBody` in
       `handlers/validate.ts`, for slice 8 to reuse;
     - a check inside the handler only.
     `completed=false`, no `completed`, and any other value are each a
     422 with `field: "completed"`. Is a query key other than
     `completed` refused, as unknown body keys are? Which message does
     a missing `completed` get (slice 6 tour item 1)?
   - **The reply.** The PRD says "200 the remaining todos", so
     `TodoListReply` can be reused. Confirm.
   - **The store.** `DELETE FROM todos WHERE completed = 1`, then
     `selectTodosStmt`, as one batch through `writeThenQueryAll`. This
     is its second use (slice 6 tour item 3). Confirm, or say what the
     helper should become.
   - **No completed todos.** Is a clear with nothing to clear a
     success that returns the list unchanged, as mark all on an empty
     list is? The button is not shown then, so only a second tab or a
     double click sends it.
   - **Where "any completed" comes from.** Options: `+page.svelte`
     works it out as `data.todos.length - data.active > 0`, as
     `allDone` is; or `load-todos.ts` adds a `completed` count. Slice
     8's scenario 8.7 says the counter and Clear completed come from
     `GET /todos/counts` on `/active`, so `load-todos.ts` may be where
     slice 8 changes it.
   - **The form.** A `?/clearCompleted` form in the footer, with the
     button as its submit. The form has no fields: the BFF always sends
     `completed=true`. Confirm.
   - **Without JS.** A plain form post. Confirm.
   - **With JS, when the rows go.** When the reply comes, as with
     remove and mark all. Confirm.
   - **A failed clear.** The footer has no error place. Options: a
     message in the footer, a message under the list, or a reload
     only. Does a failure reload (toggle and mark all do; remove does
     not; slice 6 tour item 9)?
   - **Focus after a clear.** The button goes when nothing completed
     is left, so the focus it had falls to the page. Options: move it
     to `#new-todo`, as a remove of the last row does; or leave it.
   - **Clear while a row is being edited.** Clicking the button blurs
     the edit input, which saves the edit first. If the edited todo is
     completed, the clear may delete it before the edit arrives, and
     the edit gets a 404. What does the page show then?
   - **E2e "given buy milk completed and walk dog active".** The test
     empties the list through the page first, with `removeAll` from
     `e2e/todos.ts`, as `mark-all.test.ts` does. Confirm.
4. **Known knock-ons:**
   - Scenario 7.3: after the clear no todos are left, so `hasTodos` is
     false and mark all is not rendered. Slice 6 already does this; the
     e2e test checks it.
   - When every todo is cleared, the footer and list go and the empty
     state shows, as after a remove of the last todo.
   - The `TodoFooter.svelte` comment about slice 7 is updated.
   - The `limit` message already says "Clear completed or remove some
     to add more." It does not change.
5. **Build in layers,** testing each tier:
   - contract;
   - operations;
   - d1;
   - API handler and route (`DELETE /todos`; the construct test's fake
     store gains the method);
   - BFF `api/todos.ts` and the action;
   - UI;
   - e2e 7.1–7.3 in `apps/bff/e2e/clear-completed.test.ts`.

   E2e finds the button by role and name, `button` "Clear completed".
6. **Run** `pnpm check`, `test:unit`, `test:integration` and
   `test:e2e`, each in a fresh Bash command (see Environment). Then
   tell the owner what changed in the UI. Write the review tour if
   asked, and commit when asked.

## Open, carried

- **From the slice 6 tour, §10, for the final review:**
  - **Review:** Claude's answers Q1–Q12.
  - **Smaller choices,** kept unless the owner objects:
    - valibot's own message for a missing `completed`;
    - `writeThenQueryAll`, the first transaction helper;
    - `patchTodos` beside `patchTodo`;
    - the mark-all message inside the add form, with no
      `aria-describedby`;
    - reload after a failure: yes for toggle and mark all, no for
      remove;
    - no kept test for mark all without JS, edit then mark all, or the
      failure in the browser.
  - **Profile-notes candidates:**
    - each form keeps its own failure, now in five places;
    - a button outside its form, joined by the `form` attribute, when
      the design puts it inside another form;
    - a write and its read as one D1 batch.
  - Handoff 08 said §10 of the slice 5 tour held the owner's review of
    Q3–Q11. It only lists them as open. They are treated as kept.
- **From the slice 5 tour, §10:**
  - **Review:** Claude's answers Q3–Q11.
  - **Smaller choices,** kept unless the owner objects: the change
    count instead of `RETURNING`; the handler alias; a gone todo
    removed silently; focus found through the DOM; focus moves after a
    mouse remove too; no reload after a failed remove; no kept test
    for focus, no-JS remove or opacity.
  - **Profile-notes candidates:**
    - each form keeps its own failure;
    - API words and UI words may differ (slice 5 Q2).
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
- **Later slices:**
  - 8: the filters and `GET /todos/counts`.
  - Then the final review the owner named.
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
- **Not checked:** slices 2 to 6 in light and dark, by eye. That is
  the owner's to do.

## Environment

- `pnpm install` is the owner's to run.
- `git fetch` fails in the sandbox. `claude.ai` and
  `sparrow.cloudflare.com` are blocked; this makes no difference.
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
- **zsh:** use `'-----'` as a separator, and quote `--include` globs.
  `$TMPDIR` is `/tmp/claude-1000`.
- **ugrep** (the `grep` here) rejects long `.{0,N}` context patterns.
  To read snippets of the design export, use `python3 -I`.
- **A throwaway e2e spec** for a hand check goes in `apps/bff/e2e/`,
  named so it runs last (slice 6 used `zz-scratch.test.ts`), and is
  deleted after the check.
