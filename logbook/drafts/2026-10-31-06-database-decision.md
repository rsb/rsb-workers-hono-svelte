# Stage 06 (Database): decision record and PRD amendment

> **Approved by the owner, 2026-10-31.** The amendment below is applied
> to `prd/todo.md`, which records it under Amendments. Line numbers
> here are those before the amendment. Questions DB1–DB11 are for the
> design conversation; no code has changed yet.

## The decision

A D1 database replaces the in-memory store, and transactions come into
scope.

The owner, 2026-10-31:
- "We don't have any configuration or a database. Introducting the
  database will naturally pull in the configuration and allow us to go
  into the database package plus how operations and the db package
  collaborate to deal with transactions."
- "in later steps we can introduce supabase postress and demonstrate a
  inport export process, plus having two ports the handle transactions
  differently."

Handoff 00's fixed input already leaves this to the owner: "an
in-memory store behind a port from the first slice; the owner decides
when and whether a real database replaces it." So this record is that
decision. It does not override handoff 00.

## Why D1 first

- **Cloudflare-native.** It is a binding, like `API`. It runs locally
  under wrangler and miniflare, so "local only" (C-fixed) holds, with
  no account, no Docker and no secret.
- **SQL by hand.** `env.DB.prepare(sql).bind(...)`, then `.all()`,
  `.first()`, `.run()` or `.raw()`. The dialect is SQLite. Migrations
  are numbered `.sql` files that wrangler applies. `exec()` is for
  maintenance and migrations only.
- **A transaction model with limits.** The D1 docs say: "Batched
  statements are SQL transactions". If one statement fails, the batch
  "aborts or rolls back the entire sequence". Outside a batch, each
  statement commits on its own. D1 has no interactive transaction: you
  cannot read, decide in code, then write inside one transaction.
  (Claude believes D1 rejects `BEGIN` and `COMMIT` statements, but has
  not checked this in the docs.)

That limit is the point. The cap check (deviation 9) is a read, then a
decision, then a write. Today the store's synchronous `count` and `add`
make it safe (D5). With D1, it has to become one conditional statement
or move behind the port. Postgres, later, can do it the other way, in
a real transaction. Comparing the two is a C-catalogue pair.

## PRD amendment

Each change, old text then new text. Line numbers are those of
`prd/todo.md` on `docs/construct`.

**Constraints, C-fixed (line 101).**
- Old: "the envelope, the stack and shape, an in-memory store behind a
  port, the API reachable only through the BFF's service binding,
  local only."
- New: "the envelope, the stack and shape, a store behind a port (in
  memory until stage 06, then D1, see Database), the API reachable
  only through the BFF's service binding, local only."

**Deviation 3 (line 115).**
- Old: "Todos persist in the API's in-memory store, not localStorage.
  They survive a reload but not a restart of the API Worker."
- New: "Todos persist in the API's D1 database, run locally by
  wrangler, not localStorage. They survive a reload and a restart of
  the API Worker."
- The rest of deviation 3 (the keys, `todos-[framework]`) stays.

**Deviation 9 (line 132).** The text stays: "The store holds at most
500 todos." Add: "The check and the insert are one atomic step in
every store (Database)."

**Shape (lines 194–205).** Two changes:
- Old: "`apps/todo/` holds `api` … `web` … and `contract` …
  `packages/` is for libraries shared across apps; the todo adds none."
  New: the A1 layout, as `README.md` describes it since refactor A
  (`apps/api`, `apps/bff`, `packages/contract/api`, `packages/business`,
  `packages/operations`, `packages/data/*`). This also settles finding
  3 of the refactor A report.
- Old: "The store is in memory, behind a port."
  New: "The store is behind a port. D1 is the store the API runs on."

**Out of scope (lines 349–351).**
- Remove: "A database, until the owner decides one replaces the
  store."
- Old: "Concurrency and transactions. An agent that introduces either
  is a finding, not a feature."
  New: "Concurrency control beyond what each store's transactions
  settle (locks held across requests, retries, optimistic versions).
  An agent that introduces it is a finding, not a feature."

**A new section, Database**, after Shape:
- D1, local only, through a `DB` binding on the API Worker. The BFF
  never reaches it.
- SQL is written by hand, with `prepare` and `bind` only: no ORM, no
  query builder, and no value is ever put into SQL text.
- The schema is a set of numbered migration files, applied by
  wrangler.
- A multi-step write that must not interleave is atomic in every
  store. Each data package says how it achieves this.

**A new section, Amendments**, at the end:
- "2026-10-31, stage 06: a D1 database replaces the in-memory store;
  transactions come into scope (logbook/drafts/2026-10-31-06-database-decision.md)."

The slices and their acceptance scenarios do not change. Scenario 2.8
("when I reload") still holds. Whether to add "when the API restarts"
is question DB9.

## Roadmap

| Stage | What | Brings in |
|---|---|---|
| 06 | D1 replaces the store | config, async ports, migrations, the first transaction case, the A10 construct split (refactor C) |
| 07 | Refactor B, the BFF | as planned in handoff 04 |
| 08 | Supabase Postgres as a second store | a secret in `.dev.vars` (rl-0012), interactive transactions, a unit-of-work port next to the intent port |
| 09 | Import and export between the stores | the first app that is not a Worker, business types as the neutral format, all-or-nothing import |

Slices 3–8 fit between any of these.

Stage 08 notes, to settle then:
- Supabase runs locally through the Supabase CLI and Docker. The owner
  runs it, because the sandbox probably cannot run Docker (not
  checked).
- The Worker reaches Postgres through Hyperdrive or a direct
  connection string. Which one is open.

"Two ports that handle transactions differently" (the owner) can be
shown in two forms:
1. **Same port, different mechanism.** One intent port,
   `addUnlessFull(todo, limit)`. D1 implements it as one conditional
   statement, Postgres as `BEGIN; SELECT … FOR UPDATE; INSERT;
   COMMIT`. The operation cannot tell them apart.
2. **A different port shape.** A unit-of-work port,
   `store.transaction(async (tx) => …)`. The operation owns the
   transaction boundary, and only Postgres can provide it.

The proposal: form 1 in stage 06, then form 2 in stage 08 next to it.

## Questions for the design conversation

Claude's recommendation follows each one.

- **DB1 Port shape.** Is the cap check an intent method on the port
  (`addUnlessFull`), or does the operation keep `count` then `add`?
  The second form is not atomic on D1. *Recommend the intent method.*
  The rule (`TODO_LIMIT`) stays in business, and the operation passes
  it in. The data package does not decide; it enforces atomically what
  it is told.
- **DB2 Who owns the port.** Today each operation declares the
  smallest interface it needs (D5, P41). Does that hold with two real
  stores, or does a shared `TodoStore` appear (api story, chapter 8,
  Open)? *Recommend keeping per-operation interfaces.*
- **DB3 Async.** D1 is async, so the ports become `Promise`-returning,
  and operations and handlers follow. Does the memory store become
  async too, so both satisfy one port? *Recommend yes.*
- **DB4 The memory store.** Delete it, or keep it as a second adapter
  that config selects (`STORE=memory|d1`)? *Recommend keeping it.*
  Then config has a real choice to make, unit tests have a fast store,
  and it shows the port with two adapters before Postgres arrives.
- **DB5 Config.** Which values (the `DB` binding, the store choice),
  validated where, and when? Chapter 2 asks whether config may fail at
  module load. *To discuss.*
- **DB6 Order.** SQL has no insertion order. `list` needs an
  `ORDER BY` on a column: an autoincrement sequence or a creation
  time. *Recommend a sequence column.* Times can tie.
- **DB7 Mapping.** SQLite has no boolean, so `completed` is stored as
  0 or 1. Data maps it both ways (chapter 8). Ids stay
  `crypto.randomUUID()` in construct.
- **DB8 Migrations.** Where they live (`packages/data/d1/migrations/`)
  and who applies them: `pnpm dev`, the integration tests and e2e.
  *To check:* `@cloudflare/vitest-plugin` can apply D1 migrations per
  test run. Claude has not checked its current API.
- **DB9 Test isolation.** The local database now outlives a run. E2e
  assumes an empty store first (P44), so it needs a reset before each
  run. Integration needs a clean database per file (P45). Should a
  "survives a restart" scenario join slice 2?
- **DB10 Errors.** A database failure becomes `internal` (500). Or
  does handoff 00's C2 return, with a new kind `unavailable` (503) and
  a health check that pings the store? *Recommend `internal` now, and
  C2 as its own decision.*
- **DB11 Construct.** `constructInfra` reads config and picks the
  store (A10). Should refactor C run as the first step of this stage,
  with no behaviour change, before D1 lands? *Recommend yes.*
