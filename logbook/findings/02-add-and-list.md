# Findings: slice 2, Add and list

Findings about the code of slice 2. Format: [README](../README.md).
Paths are under `apps/todo/`. "@ slice 2" means the commit that ends
stage 04 on `handoff/04-slice-2-add-and-list`. Numbers continue from
[01-health.md](01-health.md).

## F16 Hono's JSON validator throws on malformed JSON

- **Seen:** `hono/dist/validator/validator.js:14,18` (hono 4.13.14)
- **Part:** 3
- **Finding:**
  - `validator('json')` throws `HTTPException(400, "Malformed JSON in
    request body")`. Our `onError` turns any thrown error into a 500,
    but the PRD wants a 422.
  - When the content type is not JSON, it validates `{}` instead of
    the body.
  - `@hono/valibot-validator` wraps that validator, so it would have
    brought both behaviours.
- **Outcome:** changed. Plain valibot in `api/src/app/handlers/validate.ts:12-27`
  (D4), the adapter removed from `api/package.json`. → profile-notes#P25

## F17 The import scan holds after the refactor

- **Seen:** `api/src`, `web/src` @ slice 2
- **Part:** 1a–7
- **Finding:** a few `grep`s confirm:
  - contract is imported only by `http.ts` and three files in
    `app/handlers/`;
  - `hono` is imported only by `http.ts` and `app/handlers/`;
  - there is no `class` or `this`;
  - `crypto` is used only in `construct.ts`;
  - every import between directories under `app/` goes to an ancestor
    or down an allowed edge;
  - in web, `cloudflare:workers` appears only in `+page.server.ts`
    files, and `fetch(` only on a binding parameter.
- **Outcome:** kept → profile-notes#P27, P37, P39, P40

## F18 TypeScript cannot reduce valibot's generic object output

- **Seen:** `web/src/lib/server/api/call.ts:36-38` @ slice 2
- **Part:** 5 (web)
- **Finding:**
  - The schema is exactly the `Envelope`, but while `S` is generic,
    `v.InferOutput<typeof envelope(S)>` is a mapped type that
    TypeScript does not see as `Success<T> | Failure` ("Property 'ok'
    is optional").
  - The one `as` in the code sits here, with a comment that gives the
    reason.
  - The api avoids this because `readJson` returns
    `v.InferOutput<S>` directly.
- **Outcome:** open

## F19 Kit's origin check is off under `vite dev`

- **Seen:** `@sveltejs/kit/src/runtime/server/respond.js:100,116` (Kit
  3.1.0); a `curl` with `Origin: http://evil.example` to `/?/add`
  under `pnpm dev` returned 200
- **Part:** 1b (web)
- **Finding:**
  - The CSRF check sits inside `if (!__SVELTEKIT_DEV__)`, so it runs
    only in a build.
  - The repo does not turn it off: there is no `csrf` key in
    `vite.config.ts`. So the PRD's "the origin check stays on" holds
    for a build.
  - It cannot be seen in `pnpm dev` or `test:e2e`, which both run
    `vite dev`. It was not run against a built Worker in this session.
- **Outcome:** open → profile-notes#P43

## F20 E2E shares one API store for the whole run

- **Seen:** `web/playwright.config.ts:4-8`,
  `web/e2e/add-and-list.test.ts:1-4` @ slice 2
- **Part:** test
- **Finding:**
  - `test:e2e` starts the API once, and the store lives as long as its
    isolate. So every test sees what earlier tests added.
  - Scenario 2.1 ("given no todos") holds only because it runs first,
    with `workers: 1` and its file first alphabetically.
  - The other scenarios assert on the end of the list and on how much
    the list grew.
  - The PRD's "Given" clauses are met in spirit, not literally. A later
    slice that needs an empty list (5.2) will meet this again.
- **Outcome:** open (D19) → profile-notes#P44

## F21 An e2e add must wait for the list to grow

- **Seen:** `web/e2e/add-and-list.test.ts:9-21` @ slice 2
- **Part:** test
- **Finding:** the first draft of 2.8 asserted that the last item was
  "buy milk" right after pressing Enter. Scenario 2.5 had already left
  "buy milk" last, so the assertion could pass before the new add
  landed, and the reload could then race the post. All eight passed
  anyway. The helper now waits until the count has grown by one. A
  shared store makes "the last item is X" a weak assertion unless the
  count is pinned too.
- **Outcome:** changed (before commit)

## F22 Each integration test file gets a fresh isolate

- **Seen:** `api/test/integration/todos-list.test.ts:17-19` @ slice 2
- **Part:** test
- **Finding:**
  - "Lists nothing before the first add" passes even though
    `todos-add` and `todos-limit` also add todos. So
    `@cloudflare/vitest-plugin` gives each file its own module
    instance.
  - Tests within one file share it, which is why `todos-list` relies
    on the order of its two tests.
  - The 500-post limit test runs in its own file for the same reason.
- **Outcome:** kept → profile-notes#P45

## F23 Data satisfies the operations' interfaces without naming them

- **Seen:** `api/src/app/data/memory/todos.ts:11-21`,
  `api/src/construct.ts:11-24` @ slice 2
- **Part:** 4, 5
- **Finding:**
  - `memoryTodos()` imports only the business `Todo`.
  - `AddStore` and `ListStore` are declared by the operations (R6,
    D5).
  - The fit is checked by TypeScript where construct passes the store,
    so construct is the only file that sees both sides. This is Go's
    implicit interface satisfaction, and it costs nothing in
    TypeScript.
- **Outcome:** kept → profile-notes#P41

## F24 The business error word differs from the wire word

- **Seen:** `api/src/app/operations/todos/add-todo.ts:10,16`,
  `api/src/app/handlers/todos/post-todos.ts:13` @ slice 2
- **Part:** 4, 7
- **Finding:**
  - `addTodo` fails with `{ kind: "full" }`, and the handler answers
    `limit` (409).
  - Using the business word makes the translation visible in the
    handler's error duty (D10). Reusing `limit` would have hidden that
    the operation knows nothing about the envelope.
- **Outcome:** kept

## F25 The BFF has its own kind → status map

- **Seen:** `web/src/lib/server/todos/add-todo.ts:7` @ slice 2
- **Part:** 6 (web)
- **Finding:**
  - The add action maps `validation` → 422, `limit` → 409, and every
    other kind → 500 for `fail()`.
  - P28 says the kind → status map lives only in the api.
  - The two maps set different responses: the API's own status, and
    the page's status. But two of the numbers repeat.
- **Outcome:** open (BFF story, chapter 5)

## F26 The dependency check before a script installs online

- **Seen:** `pnpm install --offline` failed (`ERR_PNPM_NO_OFFLINE_META`
  for `@vitest/mocker`); the next `pnpm check` updated the lockfile
  itself
- **Part:** 1a (tooling)
- **Finding:**
  - After `@hono/valibot-validator` was removed from
    `api/package.json`, the offline install could not resolve from the
    cache.
  - pnpm 12 checks dependencies before running a script and installs
    when they are stale, online. That install passed the supply-chain
    policy check and removed exactly the one package from
    `pnpm-lock.yaml`.
- **Outcome:** kept (note)

## F27 The e2e browser build is installed (closes F9)

- **Seen:** `~/.cache/ms-playwright/chromium_headless_shell-1248`
- **Part:** test (environment)
- **Finding:** build 1248 is now in the cache, so `test:e2e` ran
  without the F9 workaround (`PLAYWRIGHT_BROWSERS_PATH`).
- **Outcome:** F9 closed → profile-notes#P35
