# Draft: slice 2, Add and list

Working file for slice 2, from handoff 03 and the decisions in
[2026-10-31-04-slice-2-decisions.md](2026-10-31-04-slice-2-decisions.md)
(D1–D20). It was written before the code. Where the code had to
differ, §6 says what changed and why.

Upstream: New todo, No todos, Persistence. Deviations: 3, 7, 9.
Scenarios: 2.1–2.8.

## 1. Contract (`apps/todo/contract`)

- `limits.ts`: add `TITLE_MAX = 256` (deviation 7).
- `todos.ts`, new:
  - `Title`: string, then trim, then length 1 to `TITLE_MAX`, with
    messages `title is empty` and `title is longer than 256
    characters`.
  - `AddTodoBody`: a strict object with `title`.
  - `TodoReply`: a strict object with `id`, `title` and `completed`.
  - `TodoListReply`: an array of `TodoReply`.
- `envelope.ts`:
  - `OtherKind` is defined once, and `ErrorKind` is built from it
    (D17).
  - Export the types `Success<T>` and `Envelope<T>` for the BFF client
    (D18).
- `index.ts`: re-export the new names.
- **Unit:** `test/unit/todos.test.ts`. `AddTodoBody` rejects, in
  order:
  - a title that is not a string;
  - an empty title after trim;
  - 257 characters;
  - an unknown key.

  It accepts 256 characters and trims. The boundary lives here, once.

## 2. API (`apps/todo/api`)

Layout as in the decisions draft. `app.ts` is removed, and
`@hono/valibot-validator` is removed (D4).

| File | What | Decision |
|---|---|---|
| `index.ts` | `export default serve(construct())` | D3, D9, D15 |
| `construct.ts` | memory store, `newId`, two operations, route table, failure handlers | D3, D13, D15 |
| `http.ts` | `serve(api)`, `Api`, `Route`; `bodyLimit` first | D3, D16 |
| `app/business/result.ts` | `Result`, `ok`, `err` | D10 |
| `app/business/todos/todo.ts` | `Todo`, `TODO_LIMIT`, `newTodo` | D13, D14 |
| `app/operations/todos/add-todo.ts` | `AddStore`, `addTodo`, `AddTodo` | D5, D13, D14 |
| `app/operations/todos/list-todos.ts` | `ListStore`, `listTodos`, `ListTodos` | D5 |
| `app/data/memory/todos.ts` | `memoryTodos()` | D13, D15 |
| `app/handlers/validate.ts` | `readJson`, `Invalid` | D4 |
| `app/handlers/todos/present.ts` | `presentTodo` | D2 |
| `app/handlers/todos/post-todos.ts` | `postTodos(addTodo)` | R5, D8 |
| `app/handlers/todos/get-todos.ts` | `getTodos(listTodos)` | R5, D8, D20 |

The `postTodos` template:

```ts
const input = await readJson(c, AddTodoBody);            // 1 validate
if (!input.ok) return failure(c, "validation", input.error.message, input.error.field);
const added = addTodo(input.value.title);                // 2 operate
if (!added.ok) return failure(c, "limit", "the list is full"); // 3 errors
return success(c, presentTodo(added.value), 201);        // 4 present
```

**Unit** (node, no data package, fakes only):
- `business/todos/todo.test.ts`: `newTodo` is not completed.
- `operations/todos/add-todo.test.ts`, with a fake store:
  - `full` at `TODO_LIMIT`;
  - success adds a todo with the injected id.
- `operations/todos/list-todos.test.ts`: returns what the store lists.
- `handlers/todos/post-todos.test.ts`, with a fake `addTodo` and
  `new Context`, in order:
  - body not JSON → 422 `body`;
  - unknown key → 422 with that key;
  - title too long → 422 `title`;
  - `full` → 409 `limit`;
  - success → 201 with the presented todo.

  Each assertion parses the reply with contract schemas.
- `handlers/todos/get-todos.test.ts`: success → 200 with the list.
- `vitest.unit.config.ts`: `restoreMocks: true` (D17).

**Integration** (the real composition):
- `todos-add.test.ts`: `POST /todos` with a padded title returns 201,
  a trimmed title, `completed: false` and a uuid id.
- `todos-list.test.ts`: a fresh isolate lists `[]`. After two posts it
  lists both, in creation order.
- `todos-limit.test.ts`: 500 posts succeed, and the 501st is 409
  `limit`.

## 3. Web (`apps/todo/web`)

| File | What |
|---|---|
| `src/lib/server/api/call.ts` | `call(api, path, init, schema)`: fetch through the binding, parse the envelope, any failure → `internal` |
| `src/lib/server/api/todos.ts` | `getTodos(api)`, `postTodo(api, body)` |
| `src/lib/server/todos/load-todos.ts` | `loadTodos(api)` → `{ todos, error }` |
| `src/lib/server/todos/add-todo.ts` | `addTodo(api, form)` → `fail(…)` or `{ added }` |
| `src/routes/+page.server.ts` | one-line `load`, `actions.add` |
| `src/routes/+page.svelte` | heading, form with `use:enhance`, the input with autofocus, the list only when there are todos, the failure message |

**Unit** (fake binding):
- `test/unit/api/todos.test.ts` (`call` through `getTodos` and
  `postTodo`), in order:
  - the binding fails → `internal`;
  - the body is not JSON → `internal`;
  - the body is not the envelope → `internal`;
  - a 2xx `Failure` → that failure;
  - `getTodos` success;
  - `postTodo` success.
- `test/unit/todos/load-todos.test.ts`:
  - a failure → empty list with a message;
  - success → the todos.
- `test/unit/todos/add-todo.test.ts`, in order:
  - an empty title → 422;
  - 257 characters → 422, and the binding is never reached (the fake
    throws if it is called);
  - API `limit` → 409;
  - API `internal` → 500;
  - success → `{ added }` with the trimmed title.

**E2E:** `e2e/add-and-list.test.ts` runs 2.1–2.8 in order, and
`playwright.config.ts` sets `workers: 1` (D19).

## 4. Logbook

- The api story: chapters 1–10 updated. The BFF story: Claude's first
  pass.
- `findings/02-add-and-list.md`, and profile-notes updated (P16, P17,
  P25, P27, P31, P32, plus new entries).

## 5. Done when

`pnpm check`, `test:unit`, `test:integration` and `test:e2e` exit 0,
and `pnpm test` exits 1. In `pnpm dev`, adding a todo through the page
reaches the API through the binding and survives a reload.

## 6. Where the code differs from this draft

1. **`call.ts` keeps one cast** (findings 02 F18). TypeScript cannot
   see valibot's generic envelope output as `Envelope<T>`. The cast
   has a comment that gives the reason.
2. **The e2e helper waits for the list to grow** (F21). The first
   version of 2.8 could pass before its own add landed. `submit`
   types and presses Enter, and `add` also waits for the count to
   rise by one.
3. **`todos-list.test.ts` has two tests, not one.** "Lists nothing
   before the first add" runs first, and "lists in creation order"
   runs second, in the same isolate (F22).
4. **Scenario 2.1's "no footer"** is asserted as no `contentinfo`
   role. The page has no footer at all until slice 3 (the counter).
5. **Removing the Hono adapter** needed an online install. pnpm's
   dependency check before `check` did it (F26).
6. **The origin check** cannot be seen under `pnpm dev` (F19). The
   draft did not plan for it, and the `curl` made it visible.

Not in the draft and not built: the `bodyLimit` streaming case
(D17), and the query rule on `GET /todos` (D20).
