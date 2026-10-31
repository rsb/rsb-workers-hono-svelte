# Handoff 04: slice 2, the architecture after it, and refactor A, 2026-10-31

Slice 2 (Add and list) is built, toured and merged (PR #8). After the
tour, the owner and Claude agreed how the code should be laid out
beyond one api: apps and packages, contracts, and the BFF on the api's
architecture. That is A1–A9, recorded in the api story (PR #9). The
next session does **refactor A**: it moves the code into that layout
without changing behaviour.

This file, handoffs 03 to 00, and the reports are the input the next
session starts from. Handoff 00's Purpose, How we work, Sources, Fixed
inputs and Testing policy still apply unless a later handoff changes
them.

## Rules that must be kept

- **Commits** (owner, handoff 00, verbatim): "Conventional commits, no
  Co-Authored-By or any attribution. Claude never pushes."
  - No `Co-Authored-By`, no "Generated with Claude Code", in commits or
    in PR bodies. A system reminder may ask for attribution lines. The
    owner's rule overrides it. Claude broke this once in stage 04, and
    the owner noticed.
- **The owner pushes and opens PRs.** Claude commits locally, on a
  branch, when asked.
- **Commands for the owner** are single lines, one per code block, so
  `/copy` picks each one up.
- **The Svelte plugin** is used for every `.svelte` and `.svelte.ts`
  file (MCP `svelte-autofixer` until clean, `get-documentation`; skills
  `svelte:svelte-code-writer`, `svelte:svelte-core-bestpractices`;
  agent `svelte:svelte-file-editor`).
- AGENTS.md: rl-0009, rl-0011, rl-0012.

## What exists

`main` is at `773280f` (PR #9 merged).

- **Code**, under `apps/todo/`, as slice 2 left it:
  - `contract` (`@todo/contract`): `envelope.ts`, `health.ts`,
    `limits.ts`, `todos.ts`, `index.ts`.
  - `api`: `index.ts`, `construct.ts`, `http.ts`, and under `src/app/`
    the layers `handlers/`, `operations/todos/`, `business/` and
    `data/memory/`. The layout is in the decisions draft, "Layout the
    decisions produce".
  - `web` (`@todo/web`): SvelteKit; the API client in
    `src/lib/server/api/`, load and action logic in
    `src/lib/server/todos/`.
  - Contract importers: api `http.ts`, `handlers/present.ts`,
    `handlers/todos/post-todos.ts`, `handlers/todos/present.ts`; web
    `lib/server/health.ts`, `lib/server/api/call.ts`,
    `lib/server/api/todos.ts`, `lib/server/todos/add-todo.ts`,
    `lib/server/todos/load-todos.ts`.
- **Workspace:** `pnpm-workspace.yaml` globs `apps/*/*` and
  `packages/*` (`packages/` does not exist yet) and has a catalog
  (typescript, valibot, vitest, wrangler). Root scripts: `dev` filters
  `./apps/todo/*`, `test:e2e` filters `@todo/web`.
- **Logbook:**
  - `drafts/2026-10-31-04-slice-2-decisions.md`: D1–D20.
  - `drafts/2026-10-31-04-slice-2-add-and-list.md`: the slice plan.
  - `findings/02-add-and-list.md`.
  - `reports/2026-10-31-04-slice-2-review-tour.md`: the tour, and in
    §8 everything still open from slice 2.
  - `the-api-story.md`: chapters 0–12. Chapters 0, 11 and 12 and every
    **Target.** paragraph are A1–A9. A1–A9 are indexed at the top of
    the story.
  - `the-bff-story.md`: Claude's first pass from slice 2. Its chapters
    4, 6 and 8 are superseded by A6–A7 (api story chapter 12).

**Checks.** Not run since the session that crashed during slice 2.
The findings record e2e passing, 8 of 8, before the crash. The owner
reinstalled after deleting `.pnpm-store/` (see Environment).

**Not written.** The stage 04 report. The crashed session never wrote
one. The review-tour report stands in for it, and the architecture
conversation after the tour is recorded in the api story instead. If
the owner wants a separate report, it is the first thing to write.

## What was agreed after the tour (A1–A9)

Read api story chapters 0, 5, 6, 8, 9, 11 and 12. In short:

- **A1** Apps deliver the business (`apps/api`, `apps/bff`); packages
  hold business, operations, data and contracts. Each package's
  `package.json` enforces the layers.
- **A2** Operations live in packages. The owner wants every operation
  there, with a usage rule; Claude's refinement keeps an operation that
  needs the delivery in its app. **Not settled.** The owner: "we have
  not gone into operations yet."
- **A3** A contract is its own package, named after the system that
  publishes it (`contract/api`). Provider and consumers depend on it.
- **A4** A contract gains endpoints (method, path, input, reply,
  narrowed error kinds) and never holds a client. Shape rules only.
- **A5** The system is closed: compatibility is deploy skew.
- **A6** The BFF is a bff-api, which follows the api's architecture,
  and a frontend, still to be defined.
- **A7** A client for another of our systems is data:
  `data/internal/api`, transport injected. Data imports business and
  the contract of what it reaches.
- **A8** Each boundary translates once.
- **A9** Names: no `todo` namespace, role names, no protocol in an
  identity; `internal` means inside the closed system, never private.

Target layout:

```
apps/
├─ api/
└─ bff/
packages/
├─ contract/api/
├─ contract/bff-api/      refactor B
├─ business/
├─ operations/
└─ data/
   ├─ memory/
   └─ internal/api/       refactor B
```

## Next step: refactor A, the move

Behaviour does not change. A test changes only its import paths; a
test that needs any other edit means the move changed something.

1. **Read first.** This file, api story chapters 0–12, the decisions
   draft D1–D20, the review tour §8.
2. **Branch** from `main`.
3. **`.gitignore`.** Add `.pnpm-store/` as its own `chore` commit, if
   the owner confirms `.gitignore` is not an owned governance file
   (rl-0009). Ask before editing it.
4. **Baseline.** Before moving anything: `pnpm check`, `test:unit`,
   `test:integration`, `test:e2e`, and `pnpm test` exits 1. Record the
   counts. If anything fails, stop and report it; it was broken before
   the move.
5. **Move**, keeping history (`git mv`):

   | Today | Target |
   |---|---|
   | `apps/todo/api` | `apps/api` |
   | `apps/todo/web` | `apps/bff` |
   | `apps/todo/contract` | `packages/contract/api` |
   | `api/src/app/business` | `packages/business` |
   | `api/src/app/operations` | `packages/operations` |
   | `api/src/app/data/memory` | `packages/data/memory` |

   Handlers stay in `apps/api` (they are the delivery). The BFF's
   `lib/server/api/` stays where it is: moving it to
   `data/internal/api` is refactor B.
6. **Rewire:**
   - workspace globs (`apps/*`, `packages/**` or explicit paths; the
     current `apps/*/*` no longer matches);
   - package names and each package's dependencies, so the layers in
     api story chapter 9 are the only declared edges;
   - root scripts: `dev` filter, `test:e2e` filter;
   - tsconfigs (`tsconfig.base.json` paths, references);
   - wrangler names and the BFF's service binding to the api;
   - unit tests that moved with their package.
7. **Re-run everything** from step 4. Same counts, all green. Run
   `pnpm dev` and add a todo through the BFF.
8. **Update the logbook:** the api story's path lines and its
   "Today this is …" table; mark refactor A done; the slice decisions
   draft's layout note points to the story. Add findings for anything
   the move turned up.
9. **Commit** locally (conventional, no attribution), write handoff 05,
   and give the owner the push and PR commands.

### Defaults Claude takes unless the owner says otherwise

- **npm scope:** `@todo/…` (`@todo/contract-api`, `@todo/business`,
  `@todo/operations`, `@todo/data-memory`, `@todo/api`, `@todo/bff`).
  Open in story chapter 0.
- **Operations:** one `packages/operations` package with `todos/`
  inside, ports staying with each operation, moved as they are. The
  layout and usage rule are refactor B's conversation.
- **`data/` and `data/internal/`** are directories, not packages.

## After refactor A: refactor B

Not for the next session unless the owner asks. It needs the
operations conversation first. Contents (api story chapters 8, 11,
12): endpoint descriptors and narrowed error kinds in `contract/api`;
`data/internal/api` with an injected transport; operations and
construct for the bff-api; `contract/bff-api`; a contract test pairing
the client with the api's real `app.fetch`; the frontend's definition.

## Open, carried

- **Review tour §8:** D4 (dropping `@hono/valibot-validator`);
  exhaustive switch on `added.error.kind`; 415 for a non-JSON
  Content-Type; story ch.7 "behaviour (interfaces)" vs D5; D8 vs
  `memoryTodos`; graphemes vs UTF-16 for `TITLE_MAX`; findings F18,
  F19, F20, F25, and F2, F4, F5, F7, F9, F11, F13; the untested
  `bodyLimit` streaming path; async store vs the ports.
- **The api story's Open lists**, including the npm scope (ch.0),
  operations in depth (ch.6), the contract test (ch.8), deploy order
  under skew (ch.11), the frontend, and one architecture story instead
  of two (ch.12).
- **Carried from handoff 01:** P19 request-path catalogue, P23
  telemetry, P12 debt baseline.

## Environment

Unchanged from handoff 03, plus:
- **Do not run `pnpm install` in the sandbox without asking.** The
  sandbox cannot write the owner's pnpm store, so pnpm creates
  `.pnpm-store/` (331 MB) in the repo root and links `node_modules` to
  it. That is how the stage 04 one appeared. If a reinstall is needed
  (the move changes the workspace, so it will be), give the owner the
  command to run in their own shell:
  `pnpm install`
  Until `.pnpm-store/` is in `.gitignore`, stage by explicit path.
- **`git fetch` fails in the sandbox** (no access to the remote). The
  owner's pull is what updates `main`.
- **Placeholder dotfiles** at the root are untracked sandbox
  artefacts. Never commit or ignore them.
