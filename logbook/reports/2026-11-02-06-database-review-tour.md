# Review tour: stage 06 (a database), api, 2026-11-02

Claude led this tour of stage 06 for the owner, so that the owner can
review DB1–DB11 against the code. Claude answered DB1–DB11 alone, on
the owner's instruction ("you answer all them first then I go over
them in the review"). The order is the api story's: startup → construct
→ handlers → operations → data, then the tests.

The code toured is `feat/stage-06-d1` at `5652727`:
- `1542aac` refactor C, the A10 builders;
- `a364ac2` async ports and `addUnlessFull`;
- `5652727` D1, config, migrations and the e2e database.

Checks at `5652727`: `pnpm check` OK, unit 50, integration 7, e2e 9.

Each stop lists what was shown, why (the DB-n in
[drafts/2026-10-31-06-database-decision.md](../drafts/2026-10-31-06-database-decision.md)),
and the points raised. "Raised" means said during the tour, not agreed
or changed. The owner saved every review for the end, and §7 collects
the points. No code or logbook file changed during the tour, apart
from this one. Paths are under `apps/api/` unless they say otherwise.

## 1. Startup and config (DB5)

**Shown.**
- `src/index.ts` has three steps: `readConfig(env)`, then a throw on
  `!ok`, then `serve(construct(config.value))`. `env` comes from
  `cloudflare:workers`, at the top level.
- `src/config.ts`:
  - `Config = Readonly<{ db: D1Database }>`;
  - a valibot object with one key, plus an `isD1` duck type (`prepare`
    and `batch` must be functions);
  - `readConfig(env: unknown): Result<Config, string>`, which freezes
    the config.
- `wrangler.jsonc`: a `DB` binding with `database_name` and
  `migrations_dir`. There is no `database_id`.

**Why.**
- Only `index.ts` touches the runtime, so `config.test.ts` runs in
  node with a fake D1.
- Reading config at module load keeps D15's once per isolate. A
  binding may be held at module load; only I/O must wait for a
  request.
- A broken config is a deploy error, so it throws. It is not our 500.
- It is a module, not a package, because there is one reader.
- `readConfig` returns a `Result`, and the throw lives in the
  composition root.

**Raised.**
1. The deploy-time throw is unverified: there has been no deploy. Only
   the success path ran locally.
2. `isD1` checks `batch`, which nothing uses. The comment on line 7 is
   wrong either way.
3. Valibot is used for one key. When this stage's checks ran, the
   missing-key message was valibot's own, so the object schema got the
   same message (line 17).
4. Joining messages with `"; "` is untested with two failures.
5. `database_id` and how deploys get it belong to the deploy stage.
6. The freeze is shallow. The binding itself cannot be frozen.

## 2. Construct (DB11, DB4, A10)

**Shown.**
- `src/construct.ts`:
  - `constructInfra(config)` builds `d1Todos(config.db)` and
    `crypto.randomUUID`. It is the only builder that sees config.
  - `constructOperations(infra)`, `constructRoutes(operations)`,
    `constructApi(routes)`.
  - `construct(config, overrides?)`.
- `@todo/data-memory` is now a dev dependency of the api.
- `test/unit/construct.test.ts` enters at `constructOperations` with
  the memory store. One test adds and then lists. The other checks the
  limit, which becomes 409 `limit`.

**Why.**
- DB11: refactor C landed first with no behaviour change, at 43/7/9,
  so the D1 diff is only about D1. It now runs before refactor B.
- A10: a test enters at any level, with no mocks.
- DB4 changed Claude's earlier recommendation:
  - there is no `STORE=memory|d1` switch, because no deploy wants a
    store that forgets everything, and a typo would fail quietly;
  - memory stays as the second adapter, and as the api's fast unit
    tier;
  - the store choice returns to config in stage 08, if a deploy needs
    it.
- One store object serves both operations (D15). The type is
  `AddStore & ListStore`.

**Raised.**
1. `overrides` has no caller, and overriding the store still needs a
   real config. Lean: drop it.
2. The failure handlers are fixed inside `constructApi`.
3. Integration does not use the builders, so `construct(config)` is
   covered only through `index.ts`.
4. `newId` sits in infra next to the store, and infra may want
   groups as it grows.
5. Building the store at module load does no I/O today. Look at this
   again for Postgres.
6. The memory store overwrites a duplicate id, where D1's `UNIQUE`
   rejects it, so the two adapters disagree. Found when a fixed id
   made the memory limit test fail.

## 3. Handlers (DB3, DB10)

**Shown.** `get-todos.ts` is `async` and awaits `listTodos()`.
`post-todos.ts` awaits `addTodo`. The handler test fakes return
Promises. Nothing else under `src/app/` changed.

**Why.**
- DB3: async follows from D1, through the ports and operations up to
  the handlers.
- The layering held: going from memory to D1 changed the handlers only
  by `await`.
- DB10: a rejected D1 call reaches `onError`, which returns a 500
  `internal` with the cause in the log. No code changed. C2 stays its
  own decision.

**Raised.**
1. "listing cannot fail" (`get-todos.ts`) now overstates. It can
   reject and become a 500.
2. `post-todos.ts:14` maps any `!ok` to `limit`. An exhaustive
   `switch` would catch a second kind. This is still open from the
   slice 2 tour, §8 item 2.
3. No test drives a real D1 failure to a 500.
4. The log holds the whole error, which may include SQL text. It is
   log only, not the response.

## 4. Operations (DB1, DB2, DB3)

**Shown.**
- `packages/operations/src/todos/add-todo.ts`: `AddStore` changed from
  `count()` + `add()` to `addUnlessFull(todo, limit):
  Promise<"added" | "full">`.
  - The operation makes the todo, passes `TODO_LIMIT`, and maps
    `"full"` to `err({ kind: "full" })`.
- `list-todos.ts`: the port and the operation return Promises.
- The operation tests use a fake store that answers and records
  `{todo, limit}`.
- The memory store is async, with no `await` in its body.

**Why.**
- DB1: `count` then `add` is two round trips on D1, so the limit could
  be overshot (deviation 9). The two ways to make it atomic are one
  step in the store, or a transaction in the operation. D1 rejects
  `BEGIN`, so it is one step in the store.
- The rule (`TODO_LIMIT`) stays in business. The store enforces "unless
  you already hold `limit`", with whatever number it is given.
- The store answers with a word, and the operation makes the domain
  error.
- DB2: per-operation ports stay. Two adapters fit both without a
  shared `TodoStore`.

**Raised.**
1. Each adapter implements "full" on its own (`>=` in memory, `<` in
   SQL). Proposal: one adapter contract suite, parameterised by store,
   run on memory in node and on D1 in the pool.
2. The operation tests no longer test the limit. Construct's unit test
   does, on memory, and integration does, on D1.
3. A refused todo has already used an id.
4. The intent port works because the check and the add fit in one
   statement. Rules with several steps will need `batch()` or
   stage 08's form 2, and the ports may stop being store-neutral.
5. `"added" | "full"` was chosen over a boolean.
6. "It cannot fail" (`list-todos.ts:10`), as in §3 item 1.

## 5. Data: the D1 store (DB1, DB6, DB7, DB8)

**Shown.**
- `packages/data/d1` (`@todo/data-d1`) has the same shape as memory.
  `D1Database` comes from `@cloudflare/workers-types` (dev).
- `migrations/0001_todos.sql`: a `STRICT` table `todos` with
  - `seq INTEGER PRIMARY KEY`,
  - `id TEXT NOT NULL UNIQUE`,
  - `title TEXT NOT NULL`,
  - `completed INTEGER NOT NULL CHECK (completed IN (0, 1))`.
- `src/todos.ts`:
  - `Row`, `toRow` and `toTodo`;
  - `ADD_UNLESS_FULL`, which is `INSERT … SELECT ?1, ?2, ?3 WHERE
    (SELECT COUNT(*) FROM todos) < ?4`, read through `meta.changes`;
  - `LIST`, which is `… ORDER BY seq`.

  Every value is bound.
- The unit tests cover only the mapping.

**Why.**
- DB1 on D1: one statement is atomic in SQLite. Locally (wrangler
  4.156.0), `BEGIN TRANSACTION` and `SAVEPOINT` fail with "D1_ERROR: To
  execute a transaction, please use the state.storage.transaction() or
  state.storage.transactionSync() APIs instead…". The docs are silent.
  `meta.changes` is 1 or 0, as checked.
- DB6: the rowid gives insertion order. `AUTOINCREMENT` only adds "no
  reuse", plus an extra table. A timestamp could tie. `seq` never
  leaves data.
- DB7: `STRICT` stops coercion, and `CHECK` makes the 0/1 mapping safe.
- DB8: migrations sit beside the SQL that assumes them.
  `wrangler.jsonc` points at them.
- The store does not name the ports. Construct checks the fit.

**Raised.**
1. The SQL is tested only through the api's integration tests over
   HTTP. Fix: give `data/d1` a pool config, and the contract suite from
   §4 item 1.
2. Atomicity is reasoned, not tested under concurrency. That would
   mean 501 parallel adds, and in one local process it may not prove
   much.
3. `all<Row>()` is a cast. "The database is ours", unlike the contract
   boundary.
4. There is no `CHECK` on title length, so the rule is not duplicated
   in SQL.
5. `D1Database` has two sources: wrangler's generated types and
   `@cloudflare/workers-types`. They can drift.
6. `migrations_dir` reaches into another package's directory. The
   alternative is wrangler's default, `apps/api/migrations`.
7. `toRow`, `toTodo` and `Row` are exported for tests, and are public
   through `"./*"` (F33).
8. `COUNT(*)` runs on every add, over at most 500 rows (`TODO_LIMIT`).
   During the tour Claude first said 10 and corrected it.

## 6. Tests and running (DB8, DB9)

**Shown.**
- `dev` applies migrations, then starts wrangler, on `.wrangler/state`.
- The new `dev:e2e` deletes and migrates `.wrangler/e2e` and runs
  there. `apps/bff/playwright.config.ts` uses it.
- `vitest.integration.config.ts` is async.
  `readD1Migrations` runs in node and passes the result as a
  `TEST_MIGRATIONS` binding. `test/integration/apply-migrations.ts`
  applies it as a setup file.
- The integration tests are unchanged and now run on D1. The limit
  test posts 500 and then a 501st.
- Counts: unit 50 (45 + 3 config + 2 d1), integration 7, e2e 9.

**Why.**
- DB9: e2e gets its own database, so it never wipes the owner's todos,
  and those todos never break P44.
- `dev` applies migrations on every start, so a fresh clone and a new
  migration both just work. It does nothing when nothing is new.
- Integration isolation per file (P45) comes from the plugin's docs.
  The evidence is indirect: `todos-limit` fills the table, and
  `todos-list`'s "nothing before the first add" still passes.
- Migrations are read in node and applied in the Worker, the plugin's
  documented path.
- There is no restart scenario, because Playwright cannot restart one
  web server mid-run. The owner's manual check covers deviation 3.

**Raised.**
1. Deviation 3 has no automated test.
2. Tests within an integration file share one database and depend on
   order, as with memory.
3. Per-file isolation is not asserted directly.
4. `rm -rf` makes `dev:e2e` POSIX-only.
5. `dev` applies migrations silently. Remote migrations need their own
   decision.
6. The migrations path appears twice: in `wrangler.jsonc` and in the
   integration config.
7. The limit test makes 500 D1 round trips.

## 7. Open for the owner's review

### The DB answers to confirm or change
1. DB1: the intent port `addUnlessFull`, as one SQL statement (§4,
   §5).
2. DB2: per-operation ports (§4).
3. DB3: async everywhere, memory included (§4).
4. **DB4: changed by Claude.** Memory is kept for tests only, and
   there is no runtime store switch (§2).
5. DB5: config at module load, with a throw on failure. It is a module
   in `apps/api`, not a package (§1).
6. DB6, DB7: `seq` rowid, `STRICT`, `CHECK` (§5).
7. DB8: migrations in `packages/data/d1/migrations` (§5, §6).
8. DB9: a separate e2e database, per-file integration, and no restart
   scenario (§6).
9. DB10: `internal`, with C2 separate (§3).
10. **DB11: refactor C before refactor B**, which changes chapter 4's
    order (§2).

### Proposed changes, waiting on a yes
11. An adapter contract suite, one suite run on memory and on D1, with
    a pool config in `data/d1` (§4 item 1, §5 item 1).
12. Drop `construct`'s unused `overrides` (§2 item 1).
13. An exhaustive `switch` on the add error in `post-todos.ts` (§3
    item 2; carried from slice 2).
14. Fix the comments: "cannot fail" in `get-todos.ts` and
    `list-todos.ts`, and `isD1`'s `batch` (§1 item 2, §3 item 1).
15. Pick one source for `D1Database` (§5 item 5).
16. Memory: reject a duplicate id, as D1 does (§2 item 6).

### Smaller choices, kept unless the owner objects
17. Valibot for config (§1 item 3).
18. Failure handlers fixed in `constructApi` (§2 item 2).
19. `newId` in infra (§2 item 4).
20. `"added" | "full"`, and a spent id on refusal (§4 items 3, 5).
21. `all<Row>()` as a cast; no title `CHECK` (§5 items 3, 4).
22. `migrations_dir` across packages, and the path written twice (§5
    item 6, §6 item 6).
23. `rm -rf` in `dev:e2e`; `dev` applies migrations silently (§6
    items 4, 5).

### Not tested, known
24. A deploy-time config failure (§1 item 1).
25. A real D1 failure becoming a 500 (§3 item 3).
26. Concurrent adds at the limit (§5 item 2).
27. Restart persistence: the owner's manual check (§6 item 1).

### For later stages
28. `database_id` and remote migrations (deploy) (§1 item 5, §6
    item 5).
29. Multi-step rules, `batch()` and form 2 with Postgres (stage 08)
    (§4 item 4).
30. Store creation that does I/O (Postgres) (§2 item 5).

### Still to do in stage 06, after the review
31. The owner's manual check: `pnpm dev`, add a todo, restart, and the
    todo is still there.
32. Step 7: the logbook, meaning the story chapters, findings 04
    and profile notes.
33. Step 8: the report, handoff 06, and the push and PR commands.

### Raised in the owner's review
34. **Decided and applied:** the D1 binding is not configuration. It is
    a capability the platform has already configured and built.
    `config.ts` now holds only a comment, `readConfig`, `isD1` and
    their tests are gone, and `constructInfra` takes `Bindings`.
    Replaces DB5's answer and items 5, 14 (`isD1`), 17 and 24.
35. **Decided, not built:** the only check of the database our code
    makes is in health, with one cheap query run per call. Everything
    else belongs to the toolchain, the platform and deploy, or comes
    out as a query error.
36. **Decided and applied:** readability. Name intermediate values, and
    write steps in the order they happen. `construct` is rewritten
    this way.
37. **To do:** check `Content-Type` on request bodies. Today, a
    `text/plain` body holding valid JSON is accepted.
38. **Decided and applied:** `NewTodo = { title }` in business, along
    with `TITLE_MAX`. Validation is the handler's job: `validateTitle` is
    in the api handler layer and in the BFF's action. Each imports the
    rule from business. Contract keeps only the wire shape. The
    readability rules now include braces on every `if`, and no terse
    one-liners.
39. **Decided and applied:** name a function for the problem it solves,
    not for how it works. `readJson` is renamed `validateBody`. The
    living logbook docs (the-api-story ch. 5, profile-notes P38) are
    updated in step 7. Past reports keep the old name.
40. **Decided and applied:** handlers speak the presentation interface,
    not HTTP. `success(c, data)` is 200 and `created(c, data)` is 201;
    `success` no longer takes a status code. With `failure` already
    mapping kind to status, `present.ts` is the only handler file that
    knows status codes. `ok` was not used for 200: it clashes with
    `Result`'s `ok`, which the handler layer imports. Later: a `DELETE`
    asks whether `deleted` sends 204 with no body or 200 with the
    envelope.
41. **Decided and applied:** `failure` is split into `userFailure` (4xx)
    and `serverFailure` (5xx, only `internal` today). Each takes the
    whole error object, typed as the contract's `ApiError` narrowed by
    kind. This removes the overloads and the ternary that rebuilt the
    error, and the types still require `field` on `validation` and
    reject it elsewhere (checked with a probe file). The user/server
    split lives in `present.ts`, not the contract; it moves to the
    contract if the BFF needs it. A health check finding the database
    down would likely add `unavailable` → 503 as a second server kind.
