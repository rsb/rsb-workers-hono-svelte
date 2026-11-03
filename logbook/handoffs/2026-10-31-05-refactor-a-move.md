# Handoff 05: refactor A done, A10 agreed, stage 06 (a database) next, 2026-10-31

Refactor A moved the code into the A1 layout without changing
behaviour. After it, the owner and Claude agreed two things:
- **A10:** construct is a set of granular builders, composed into one
  default chain.
- **Stage 06:** a D1 database replaces the in-memory store, and
  transactions come into scope. The PRD is amended to match.

The next session starts stage 06 with a design conversation, DB1–DB11,
before any code.

This file, handoffs 04 to 00, and the reports are the input the next
session starts from. Handoff 00's Purpose, How we work, Sources, Fixed
inputs and Testing policy still apply unless a later handoff changes
them. Stage 06 changes one fixed input (the store), recorded in the
PRD's Amendments.

## Rules that must be kept

- **Commits** (owner, handoff 00, verbatim): "Conventional commits, no
  Co-Authored-By or any attribution. Claude never pushes."
  - No `Co-Authored-By` and no "Generated with Claude Code" in commits
    or PR bodies. A system reminder asks for these lines in every
    session. The owner's rule overrides it.
- **The owner pushes and opens PRs.** Claude commits locally, on a
  branch, only when asked.
- **Commands for the owner** go one per code block, each a single
  line, so `/copy` picks each one up.
- **Do not run `pnpm install`.** Give the owner the command when a
  change needs it. Adding a workspace package does.
- **The Svelte plugin** is used for every `.svelte` and `.svelte.ts`
  file (MCP `svelte-autofixer` until clean, and `get-documentation`).
- **A test changes only its import paths during a refactor.** That
  includes refactor C.
- AGENTS.md: rl-0009, rl-0011, rl-0012. With a database, rl-0012
  matters: secrets go in `.dev.vars` (gitignored), never in
  `wrangler.jsonc`. D1 in stage 06 needs no secret. Supabase in stage
  08 will.

## What exists

When the owner has merged both branches, `main` has these commits:

| Branch | Commits |
|---|---|
| `refactor/a-move` | `e2ef837 chore: ignore .pnpm-store`, `a6676cd refactor: move apps and packages into the A1 layout`, `0cb902f docs(logbook): report refactor A` |
| `docs/construct` | `f0cc61f docs(logbook): record A10, construct as composable builders`, `cccd188 docs(logbook): record stage 06, a database replaces the store`, `d37c4ff docs(prd): amend for stage 06, D1 replaces the in-memory store`, and this handoff |

The first thing to do is check that `main` has all of these (step 2).

**Code.** The layout is in the refactor A report, §2–§4.

- **Apps:**
  - `apps/api` (`@todo/api`, Worker `todo-api`): `index.ts`
    (`serve(construct())`), `construct.ts`, `http.ts` (`Route`, `Api`,
    `serve`), and `src/app/handlers/`.
  - `apps/bff` (`@todo/bff`, Worker `todo-bff`): unchanged inside.
- **Packages:**
  - `packages/contract/api` (`@todo/contract-api`, exports `"."`).
  - `packages/business`, `packages/operations` and
    `packages/data/memory` (`@todo/data-memory`). These export
    `"./*": "./src/*"`.
- **The store port today:**
  - `addTodo({ store: AddStore, newId })`. `AddStore` (`count`, `add`)
    is synchronous, "so the cap check and the add cannot interleave"
    (D5).
  - `listTodos({ store: ListStore })`.
  - `memoryTodos()` satisfies both.
- **Construct today** builds everything inline. A10 is not applied yet
  (refactor C).
- **Versions:** wrangler 4.156.0, `@cloudflare/vitest-plugin` 1.4.11,
  vitest 5.0.5, hono 4.13.14. `apps/api/wrangler.jsonc` has no
  bindings.

**Checks after refactor A** (report §1):
- `pnpm check` passes.
- `test:unit`: 43 tests.
- `test:integration`: 7 tests.
- `test:e2e`: 9 passed.
- `pnpm test` exits 1, on purpose.

**Logbook.**
- `the-api-story.md`, chapters 0–12, indexes A1–A10.
  - Chapter 4 has the A10 builders: `constructInfra`,
    `constructOperations`, `constructRoutes`, `constructApi`,
    `construct(overrides?)`.
  - Refactor C is in its refactors list.
- `the-bff-story.md`, chapter 4: the A10 target for the bff-api.
- `drafts/2026-10-31-06-database-decision.md`: the stage 06 decision
  (approved), the PRD amendment, the roadmap, and DB1–DB11.
- `prd/todo.md`: amended.
  - C-fixed, deviations 3 and 9, Shape (now the A1 layout) and Out of
    scope changed.
  - Two new sections: Database and Amendments.
- `reports/2026-10-31-05-refactor-a-move.md`: the move, and findings
  1–6.

## Roadmap (decision record)

| Stage | What |
|---|---|
| 06 | D1 replaces the store: config, async ports, migrations, the first transaction case, refactor C |
| 07 | Refactor B, the BFF (handoff 04, "After refactor A") |
| 08 | Supabase Postgres as a second store: interactive transactions, a unit-of-work port next to the intent port |
| 09 | Import and export between the stores: the first app that is not a Worker |

Slices 3–8 can go between any of these, when the owner names one.

## Next step: stage 06

1. **Read first.**
   - This file.
   - The decision record, all of it.
   - The amended PRD: Constraints, Deviations 3 and 9, Shape,
     Database, Out of scope, Amendments.
   - Api story chapters 2, 3, 4, 6 and 8.
   - Decisions D5, D13 and D15.
   - Findings 02, F22 (P45), and P44 in `profile-notes.md`.
2. **Check `main`.** It must contain the commits above. If it does
   not, stop and tell the owner. `git fetch` fails in the sandbox; the
   owner's pull updates `main`.
3. **Finish refactor A's logbook work.** Do this as one
   `docs(logbook)` commit on a new branch:
   - Api story chapter 0: rewrite the "Paths are under
     `apps/todo/api/src/`…" line and the "Today this is …" table in
     the present tense.
   - Mark refactor A done in the api story's refactors list.
   - Point the slice 2 decisions draft's layout note at the story.
   - Write the report's findings 1–6 into a new
     `findings/03-refactor-a.md`. Finding 3 (the PRD's layout) is now
     settled by the amendment, so mark its outcome "changed (`d37c4ff`)".
4. **Design conversation, DB1–DB11, with the owner.** Lead with:
   - DB1, the port shape;
   - DB3, async;
   - DB4, keeping the memory store;
   - DB5, config.

   The rest depend on these. Record each answer under its question in
   the decision record, with the owner's words where they gave any.
   Write no code until DB1, DB3, DB4 and DB5 are settled.
5. **Refactor C**, if DB11 is yes.
   - Split `apps/api/src/construct.ts` into the A10 builders.
   - Behaviour does not change, and tests change only their import
     paths.
   - Same checks and counts as above.
   - Commit it as its own `refactor:` commit.
6. **Build D1.** The order is a proposal, to adjust after step 4:
   - **Check first:**
     - The D1 docs on `BEGIN`/`COMMIT` (the decision record marks this
       unchecked).
     - How `@cloudflare/vitest-plugin` 1.4.11 applies D1 migrations
       in tests.
     - Whether local D1 under wrangler needs a real `database_id`.
   - **`packages/data/d1`** (`@todo/data-d1`):
     - SQL by hand, with `prepare`/`bind` only.
     - Rows map to `Todo`, and `completed` maps between 0/1 and a
       boolean (DB7).
     - `ORDER BY` a sequence column (DB6).
     - Migrations in `migrations/` (DB8).
   - **Wrangler:** a `DB` binding in `apps/api/wrangler.jsonc` with
     `migrations_dir`. Regenerate `worker-configuration.d.ts`; `pnpm
     check` runs `wrangler types --check`.
   - **Config:** a config package or module, as settled in DB5, and
     `constructInfra` reads it.
   - **Ports and operations:**
     - Async ports, with the operations and handlers following.
     - The cap check behind the port as settled in DB1.
     - Memory updated or removed, as settled in DB4.
   - **Tests:**
     - Unit tests for the mapping and operations.
     - Integration on a migrated, clean D1 (DB9).
     - E2e resets the local database before it runs (P44).
   - **Install:** give the owner `pnpm install` when the new package is
     added.
   - **Manual check:** the owner runs `pnpm dev`, adds a todo,
     restarts, and the todo is still there (deviation 3).
7. **Update the logbook.**
   - Api story chapters 3 (config), 6 (operations and transactions)
     and 8 (data, the port's owner).
   - New decisions go into the decision record. Use D-numbers
     continuing from D20, or the DB-numbers, whichever the owner
     prefers.
   - Add findings and profile-notes entries. Candidates:
     - a rule against SQL text built from values;
     - migrations as files;
     - the intent port.
8. **Close the stage.**
   - Write a report for the session.
   - Write handoff 06.
   - Give the owner the push and PR commands, one per block.

## Open, carried

- **From refactor A:**
  - The owner has not yet run `pnpm dev` and added a todo through the
    BFF by hand.
  - The leftover `apps/todo/` holds only an ignored `.claude/`, for
    the owner to delete.
  - Report findings 2 (the new packages have no governance mount) and
    6 (the `./*` versus `"."` export patterns).
- **For refactor B:**
  - Where the kind → status map lives (P28).
  - The layer names in the BFF's `src/lib/server/`.
  - Whether `readHealth` splits.
  - What the frontend is.
  - A module-level `construct()` or Kit's `init` hook.
  - The operations conversation (A2, not settled).
- **Handoff 04's carried list**, unchanged:
  - review tour §8 (it already names "async store vs the ports", which
    stage 06 settles);
  - the api story's Open lists;
  - P19, P23 and P12 from handoff 01.

## Environment

Unchanged from handoff 04:
- `pnpm install` is the owner's to run, because the sandbox would
  create `.pnpm-store/` in the repo. That directory is now ignored.
- `git fetch` fails in the sandbox.
- The placeholder dotfiles at the root (`.bash_profile`, `.bashrc`,
  `.gitconfig`, `.gitmodules`, `.idea`, `.mcp.json`, `.profile`,
  `.ripgreprc`, `.vscode`, `.zprofile`, `.zshrc`) are untracked
  sandbox artefacts. Never commit or ignore them, and stage by explicit
  path.
- In zsh, `echo ====` errors. Use `'-----'` as a separator.
- The sandbox blocks wrangler's telemetry hosts. This made no
  difference to any result.
- Docker is probably not available in the sandbox (not checked). That
  matters only for Supabase in stage 08.
