# Review tour: slice 2 (Add and list), api half, 2026-10-31

Claude led this tour of slice 2 for the owner, as handoff 03 step 9
asks. The order is the api story's: startup → `index.ts` → construct →
handlers → operations → business → data. The BFF was not toured.

The session that built slice 2 crashed after the build, and Claude
does not remember it. This tour was rebuilt from the code, the two
stage-04 drafts and `findings/02-add-and-list.md`. No code or logbook
file changed during the tour, apart from this one.

Each stop lists what was shown, why (the D-n in
[drafts/2026-10-31-04-slice-2-decisions.md](../drafts/2026-10-31-04-slice-2-decisions.md)),
and the points raised. "Raised" means said during the tour, not agreed
or changed. The owner deferred every point to the next session, and
§8 collects them. Paths are under `apps/todo/api/src/` unless they say
otherwise.

## 1. Startup and `index.ts` (D3, D9, D15, D16)

**Shown.**
- `app.ts` is gone. `index.ts` is two steps: `const api = construct();`
  then `export default serve(api);`. A comment says there is no config
  yet.
- `http.ts` is our HTTP module, in the composition zone. `serve(api)`
  does four things:
  1. registers `bodyLimit` first;
  2. registers each route from the table with `app.on`;
  3. registers `notFound`;
  4. registers `onError`.

  It also exports the types `Route` and `Api`.
- Handlers import `Context` from `hono` directly. Nothing under `app/`
  imports `http.ts`.

**Why.**
- D3: R2 says `index.ts` tells the story in our words, and Hono stays
  behind our module.
- D9: no environment value yet, so no config.
- D15: the module body is the once-per-isolate half. The store built
  there lives as long as the isolate, which is why scenario 2.8 holds
  and why a restart loses the todos (deviation 3).
- D16: the per-request half is still only `bodyLimit`, so middleware
  keeps no home of its own and the layer has no name yet.

**Raised.**
1. Routes are registered from a table, not with a typed `.get()`
   chain. Hono's RPC client (`hc<typeof app>`) can no longer infer
   them. It is unused (the web uses contract schemas), but that option
   is now closed.
2. `Route.method` is only `"GET" | "POST"`. It widens when a slice
   needs more.
3. `tooLarge` sits in `Api` beside `notFound` and `onError`, although
   Hono treats it as a `bodyLimit` option and not as a handler. This
   keeps construct as the one supplier of failure handlers.

## 2. Construct (D3, D5, D8, D13, D15)

**Shown.** `construct.ts` builds in three rings:
1. the real things: `memoryTodos()` and
   `newId = () => crypto.randomUUID()`;
2. operations: `addTodo({ store, newId })` and `listTodos({ store })`;
3. handlers: `postTodos(addTodo)` and `getTodos(listTodos)`.

It returns the route table and the three failure handlers, typed
`Api`.

**Why.**
- D15: one store, passed to both operations, so a `POST` is seen by
  the next `GET`.
- D13: `newId` is injected. Randomness is io, so it stays out of
  business and data, and unit tests can name the id.
- D5 and F23: construct is where interfaces meet. Data never names
  `AddStore` or `ListStore`, the operations never name the memory
  store, and TypeScript checks the fit at this call.
- D8: a handler gets a constructor if and only if it has a dependency.
  This settles the tour point "handler types are mixed".
- D3: `import type { Api }` makes a route-table typo fail in construct.
  It is a type-only addition to R7's allow-list.

**Raised.**
1. Routes live in construct (R4), far from each handler's code. The
   alternative, handlers exporting their own routes, would let
   handlers decide URLs.
2. Construct is one flat function. A construct per resource may be
   wanted around slice 8. It was not built ahead of need.
3. `newId` is an inline closure, not a named ids package.
4. **Story inconsistency.** Chapter 4's **Open** list still has
   "Whether each handler needs a constructor", but D8 settles it.
   Either move it out of Open, or reword it if the owner questions
   D8.

## 3. Handlers (D1, D2, D4, D5, D6, D10, D17)

### 3a. Contract

**Shown.**
- `limits.ts`: `TITLE_MAX = 256`, in UTF-16 code units.
- `todos.ts`: `Title` (string, trim, length 1–`TITLE_MAX`),
  `AddTodoBody` (strict), `TodoReply` (strict), and `TodoListReply`.
- `envelope.ts`:
  - `OtherKind` is defined once, and `ErrorKind` is built from it.
    This closes the tour point "kinds listed twice".
  - `Success<T>` and `Envelope<T>` are exported for the BFF.

**Why.** D1: the title rule is defined once, in contract, and applied
at each edge. Business imports nothing.

**Raised.**
1. `maxLength` counts UTF-16 code units, so an emoji counts as 2.
   `v.maxGraphemes` would count what a user sees. The cheaper reading
   of deviation 7 was kept.
2. The message `"title must be text"` is not in the slice draft. It
   was added so a non-string title gets our message instead of
   valibot's default.

### 3b. `validate.ts` and `present.ts`

**Shown.**
- `readJson(c, schema)` returns `Result<Output, Invalid>`:
  - a body that is not JSON → `field: "body"`;
  - a schema issue → the first path key of the first issue, or
    `"body"` when the issue has no path.
- `present.ts` is unchanged from slice 1.

**Why.** D4 (F16): Hono's `validator('json')` has two problems:
- it throws `HTTPException(400)` on malformed JSON, which our
  `onError` turns into a 500;
- it validates `{}` when the content type is not JSON.

A returned value keeps all four duties visible in the handler. Side
effect: the `HTTPException` → 500 case is now unreachable from our
code. That point is moot, not fixed (D17).

**Raised.**
1. **D4 reverses the owner's P25** (`@hono/valibot-validator`). It
   needs the owner's confirmation.
2. `c.req.json()` does not check `Content-Type`. A `text/plain` body
   that is valid JSON is accepted. There is no 415, and the PRD does
   not ask for one.
3. Only the first issue is reported. That matches the envelope's
   single `field`.

### 3c. `todos/present.ts`

**Shown.** `presentTodo(todo: Todo): TodoReply` copies the three
fields by name.

**Why.**
- D2: a todo is two types. Copying by name means a new business field
  never reaches the wire silently, where the web's strict schema would
  reject it.
- For todos, this also ties `success` data to the contract type.
  Health's `{ ok: true }` is still a literal.
- D5: `handlers/todos/` is one package. Siblings share only through
  their parent.

### 3d. `post-todos.ts`, `get-todos.ts`

**Shown.**
- `postTodos` is R5's four duties as four lines: `readJson`, then
  `addTodo`, then `failure(c, "limit", …)`, then
  `success(c, presentTodo(…), 201)`.
- `getTodos` has two duties: no validation (D20), and listing cannot
  fail.

**Why.**
- D6: handlers import operation types with `import type`, and import
  business directly. `handlers → business` is a new downward edge.
- D10 and F24: the business word `full` becomes the wire word `limit`
  in the handler.

**Raised.**
1. **Flaw.** `post-todos.ts:14` checks only `!added.ok`, not
   `added.error.kind`. The mapping that D10 calls explicit is implicit
   today. If a second error kind arrives, TypeScript will not force
   the handler to handle it, and the new kind would answer `limit`.
   Claude proposes an exhaustive `switch`, about 3 lines.

## 4. Operations (D5, D8, D10, D13, D14)

**Shown.**
- `add-todo.ts`:
  - declares `AddStore` (`count`, `add`);
  - declares `AddTodo = (title) => Result<Todo, { kind: "full" }>`;
  - checks `count() >= TODO_LIMIT` before it makes the todo.
- `list-todos.ts`: declares `ListStore` (`list`, in the order added),
  and `ListTodos` returns `readonly Todo[]`.

**Why.**
- D5 (R9): each operation declares its own small interface. There is
  no shared `TodoStore`.
- D14: the cap is a business constant checked by the operation, not
  by the store. The ports are synchronous, so the check and the add
  cannot interleave, and the cap is exact (the 501st post is 409).
- D10: an operation that can fail returns `Result`. One that cannot
  fail returns its value.
- D13: `newId` is injected.
- D8: closures, with PascalCase names for the type each constructor
  returns.

**Raised.**
1. `listTodos` is a pass-through over `store.list()`. It is the
   clearest ceremony in the slice. It is kept so that handlers never
   touch data, and so that slice 8's filter has a home.
2. The error type is written inline (`{ kind: "full" }`). A named
   union is what makes the exhaustive switch in §3d useful once a
   second kind exists.
3. Creation order is promised only in a comment on `ListStore`.
   `todos-list.test.ts` is what enforces it.
4. `deps.store` instead of destructuring. This is taste.
5. Story **Open**: what happens to the ports, and to how exact the cap
   is, when a store needs `await`. The likely answers are a
   transactional port (`addIfBelow(limit, todo)`) or accepting an
   approximate cap.

## 5. Business (D1, D2, D10, D13, D14)

**Shown.**
- `result.ts`: `Result<T, E>`, with `ok` returning `Result<T, never>`
  and `err` returning `Result<never, E>`.
- `todos/todo.ts`: `Todo`, `TODO_LIMIT = 500`, and
  `newTodo(id, title)`.

**Why.**
- D10: anything may import business, so `Result` reaches every layer
  without a new edge. It stays out of contract (C4).
- D2: `Todo` is the api's own type.
- D14: the cap is a rule about the list.
- D13: `newTodo` is pure, and the id is passed in.
- D1: business does no title check.

**Raised.**
1. **Story tension.** Chapter 7 says business holds "types, behaviour
   (interfaces) and pure logic". D5 put the store interfaces in
   operations, following R9. Either the phrase means rules as
   functions, not ports, and the story should say so, or D5
   contradicts the review text and the owner decides which wins.
2. `Result` is a generic helper under `business/`. If more helpers
   like it appear, they may need their own home (`app/kernel/`,
   `app/lib/`). This is the story's new **Open** item.
3. `Todo` is not `readonly`. The memory store's copies guard stored
   state instead. `Readonly<…>` would make that a fact of the type.
4. The title is a plain `string`, not a branded `ValidTitle`. A brand
   would make "already valid" a fact of the type, but it pulls the
   title rule back toward business, against D1.

## 6. Data (D5, D13, D14, D15)

**Shown.**
- `data/memory/todos.ts`: `memoryTodos()` keeps
  `Map<id, Row = { title, completed }>`, and returns
  `{ count, add, list }` as closures.
- It imports only the business `Todo`.

**Why.**
- R6: one package per real thing. The real thing here is the isolate's
  memory, and a D1 store would sit beside it.
- It maps `Todo` ↔ row as a real store would.
- D13: a `Map` iterates in insertion order, so creation order needs no
  order field.
- It copies in and out.
- D5: it fits the ports implicitly.
- It makes no ids and checks no rules.
- D15: it is built once.

**Raised.**
1. **D8 not followed.** There is no exported `MemoryTodos` type, while
   D8 says each constructor's return type is named. Either add
   `export type MemoryTodos = ReturnType<typeof memoryTodos>`, or
   narrow D8 to "when another file needs the type".
2. `add` overwrites on a duplicate id (`Map.set`). A database would
   reject the duplicate instead. No test pins either behaviour.
3. `list` returns `Todo[]` where the port says `readonly Todo[]`. It
   fits, and the array is new on each call.
4. The story's **Open** item "Who owns the port if a database package
   replaces the memory store (L5's second half)" looks answered by D5:
   operations own their ports. Close it, unless L5 meant a port shared
   by several data packages.

## 7. Not toured

- **The BFF:**
  - `web/src/lib/server/api/` (`call.ts`, `todos.ts`);
  - `web/src/lib/server/todos/` (`load-todos.ts`, `add-todo.ts`);
  - `+page.server.ts` and `+page.svelte`;
  - D18 and D19;
  - `logbook/the-bff-story.md`.
- **The tests** of all three tiers, api and web.
- **Findings F16–F27** and the profile-notes changes, as a list.

## 8. Open for the next session

### Decisions for the owner
1. Confirm D4: drop `@hono/valibot-validator` (reverses P25) (§3b).
2. Make the error mapping in `post-todos.ts` an exhaustive `switch`,
   with a named error union in `add-todo.ts` (§3d, §4).
3. Reject a non-JSON `Content-Type` with a 415, or not (§3b).
4. Business "behaviour (interfaces)" vs D5's ports in operations
   (§5).
5. D8 and `memoryTodos`: add `MemoryTodos`, or narrow D8 (§6).
6. Count titles in graphemes or UTF-16 code units (§3a).

### Story edits waiting on those answers
7. Chapter 4: move "whether each handler needs a constructor" out of
   **Open** (§2).
8. Chapter 8: close "who owns the port", or restate it (§6).
9. Chapter 7: reword "behaviour (interfaces)" once item 4 is decided.

### Smaller choices, kept unless the owner objects
10. Route table vs Hono's typed chain, and the RPC client given up
    (§1).
11. `tooLarge` in `Api` (§1).
12. Routes in construct; one flat construct (§2).
13. `listTodos` as a pass-through (§4).
14. `Todo` not `readonly`; no branded title (§5).
15. Duplicate id overwrites in the memory store (§6).

### Carried, not toured
16. The BFF tour and the BFF story (§7).
17. Open findings:
    - F18: the cast in `call.ts`;
    - F19: the origin check is not seen under `vite dev`;
    - F20: e2e shares one store;
    - F25: the BFF has its own kind → status map;
    - earlier: F2, F4, F5, F7, F9, F11, F13.
18. Still open from D17: the `bodyLimit` streaming path is untested.
19. The async-store question for the ports and the cap (§4).

### Housekeeping before the stage-04 commit
20. The stage-04 report and handoff 04 do not exist. The crashed
    session did not write them.
21. `.pnpm-store/` (331 MB) is untracked and not in `.gitignore`. It
    is probably from F26's online install. Ignore or delete it; do not
    commit it.
22. `pnpm check` and the three test tiers were not re-run after the
    crash. The findings record the e2e run passing, 8 of 8.
23. Only the deletion of `api/src/app.ts` is staged.
