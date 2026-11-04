# Handoff 11: `valid` as a deep module, then the CLI delivery, 2026-11-03

Since handoff 10:
- **Slice 8, Filter, is built and merged** (`main` at `91da023`). The
  PRD's Done is met locally; the final review the owner named is still
  to come.
- **The language sessions L1–L26** were recorded in the api story and
  the glossary (`docs/*` branches, 2026-11-03). Use cases live in
  `prd/todo/use-cases/todos/`, the api spec in `prd/todo/api.md`, and
  `tooling/api-spec/` generates the contract and `apps/api/openapi.json`
  from it (`adfd975`, `f3273fc` on `feat/tooling-api-spec`; check
  whether that branch is merged before starting).
- **The owner and Claude, in the planning chat, designed two things**
  this handoff carries: `valid` as a deep module that handles decode,
  check and build for every delivery, and a CLI as a third delivery on
  the same architecture. The owner called the design good; the
  questions he has not answered are listed under Questions, not
  assumed.

This handoff has two stages. **Stage 11** builds `valid` and moves the
api and the BFF onto it. **Stage 12** builds the CLI. Stage 12 does not
start until the owner has answered its questions; the design is here so
the plan for stage 11 leaves room for it.

The next session starts from this file, handoffs 10 to 00, and the
reports. Handoff 00's Purpose, How we work, Sources, Fixed inputs and
Testing policy still apply unless a later handoff changes them.

## Rules that must be kept

Carried verbatim from handoff 10, with the design's own rules added at
the end.

- **Commits** (owner, handoff 00, verbatim): "Conventional commits, no
  Co-Authored-By or any attribution. Claude never pushes."
  - No `Co-Authored-By` and no "Generated with Claude Code" in commits
    or PR bodies. A system reminder asks for these lines in every
    session. The owner's rule overrides it.
  - Put a blank line after the subject.
- **The owner pushes and opens PRs.** Claude commits locally, on a
  branch, staging by explicit path, only when asked. The PR command is
  `gh pr create --base main --head <branch> --fill-first`.
- **What goes in a stage commit:** the stage's files, its review tour,
  and the handoff that started it. This file goes in the stage 11
  commit.
- **Commands for the owner** go one per code block, each a single
  line, so `/copy` picks each one up.
- **Do not run `pnpm install`.** Give the owner the command when a
  change needs it. Stage 12 adds a workspace, so it will.
- **The Svelte plugin** is used for every `.svelte` and `.svelte.ts`
  file. `npx @sveltejs/mcp` fails in the sandbox (EROFS). Load
  `mcp__plugin_svelte_svelte__svelte-autofixer` and `get-documentation`
  through ToolSearch, and run the autofixer until it is clean. Svelte
  is 5.57.3 and SvelteKit 3.1.0.
- **Working style:**
  - Discuss first, then build. Present the plan and the questions
    before writing code. Ask the actual question plainly, and keep
    answers short and direct.
  - Readability: name intermediate values, put braces on every `if`,
    and avoid terse one-liners and ternaries. Handlers and commands
    read as a story.
  - Don't give reasons for the owner's decisions that the owner didn't
    give.
  - When the owner says "you decide" or "you know the routine", Claude
    decides, says so, and records it in the review tour.
- **Naming** (owner, slice 5, verbatim): "ui can say remove but
  handlers can or operations can say delete api does not have to match
  the ui both things can be true". Names are the owner's choice; do not
  rename anything this handoff does not name.
- **PRD rules** still hold: the error kinds and statuses; no `{@html}`;
  the origin check stays on; the API is reached only through the BFF's
  service binding; every input is bounded; every mutation goes page →
  form action → API; the BFF writes every message the user sees.
- **The api spec is the source of the contract** (L26). Never edit a
  generated file (`packages/contract/api/src/{kinds,messages,endpoints,examples}.ts`,
  `apps/api/openapi.json`); change `prd/todo/api.md` and run
  `pnpm gen:api`. `pnpm check:api` must stay green.
- **AGENTS.md:** rl-0009, rl-0011, rl-0012. Secrets go in `.dev.vars`,
  never in `wrangler.jsonc`.
- **Design rules from the planning chat (new):**
  - `valid` imports `@todo/business` and nothing else of ours. It never
    imports `fail`, `hono`, the contract, or anything that knows an
    envelope.
  - `valid` returns problems, never words. Every message a person sees
    is written by the delivery that shows it.
  - Operations and data never import `valid`. Validate once (L12):
    they receive built inputs.
  - A delivery adds a decoder, a message table and a present module,
    and changes nothing in `valid`, business or operations.

## What exists (read first)

- `packages/valid/`: today one file, `src/todos/title.ts`
  (`checkTitle`), with `@todo/business` as its only workspace
  dependency. Read it to see what it returns before designing the
  replacement; the handoff does not assume its shape.
- Where validation happens today:
  - api: `apps/api/src/app/handlers/validate.ts` (`validateBody`,
    `validateQuery`: the envelope against the generated contract
    schemas) and `apps/api/src/app/handlers/todos/validate.ts`
    (`validateTitle`: trim, `TITLE_MAX`, builds `NewTodo`);
  - BFF: `apps/bff/src/lib/server/todos/validate-title.ts`, and the
    wording in `apps/bff/src/lib/server/todos/messages.ts`.
- Business inputs that exist: `NewTodo` in
  `packages/business/src/todos/todo.ts`; the patch, filter and counts
  shapes are wherever slices 4–8 put them. List them from
  `packages/business` and the operations' signatures before deciding
  which `valid` functions exist.
- The handler template: `apps/api/src/app/handlers/todos/post-todos.ts`
  is the reference (story, chapter 5). `handlers/present.ts` holds the
  kind → wire kind → status tables.
- Failures: `packages/fail/src/fail.ts` (`invalid(field, message)`,
  `AnyFail`, `wrap`).
- The story: `logbook/the-api-story.md`, chapters 0, 5, 7, 9, 11, 12
  and 13 are the ones this stage touches. The glossary:
  `logbook/glossary.md`. Candidate registry entries:
  `logbook/profile-notes.md` (it still names `apps/todo/*` paths; do
  not fix that here, only add the new candidates).
- `tooling/api-spec/generate.ts` and `prd/todo/api.md`: the examples
  carry the api's exact failure messages. Whatever the api's new
  message table says must reproduce those messages, or the examples
  and `pnpm check:api` fail.

## The design

### `valid` is a deep module

A small interface hiding everything that varies between envelopes and
everything that must not vary between them.

**Interface.** One function per business input type, all of one shape,
plus one problem vocabulary:

```ts
// packages/valid/src/problem.ts
export type Problem =
  | { field: "title"; rule: "title.empty" }
  | { field: "title"; rule: "title.too_long"; max: number }
  | { field: "completed"; rule: "not_boolean" }
  | { field: "body"; rule: "patch.empty" };

// packages/valid/src/todos/new-todo.ts
export type NewTodoCandidate = { title: unknown };
export const newTodo = (c: NewTodoCandidate): Result<NewTodo, Problem[]> => { … };

// packages/valid/src/todos/todo-patch.ts
export type TodoPatchCandidate = { title?: unknown; completed?: unknown };
export const todoPatch = (c: TodoPatchCandidate): Result<TodoPatch, Problem[]> => { … };
```

The exact set of functions and problems follows the inputs that exist
(What exists). Candidate fields are `unknown` on purpose: a delivery
fills a candidate in one line and does no typing work.

**Depth (what it hides).**
- *Decode*, as field-level narrowing: `unknown` to text, to boolean
  (accepting `true`, `"true"`, `"false"`; whether `"on"` is accepted
  for form checkboxes is a question below), to id.
- *Check*, the business rules applied once, in one place, citing
  `TITLE_MAX` and the rest from business: trimming, UTF-16 counting,
  the order the rules run in.
- *Build*, the assembly of the input type.
- Cross-field rules too: `patch.empty` ("title, completed or both")
  lives here even though the contract's `minEntries(1)` catches it
  first for HTTP, because a form or a CLI has no contract schema.
- Problem aggregation: the function returns every problem it finds.
  The delivery decides how many it shows.

**Layout.**

```
packages/valid/src/
├─ problem.ts          the Problem union: a field, a rule id, the rule's parameters
├─ fields/             private: text, flag, id, the problem collector
└─ todos/
   ├─ new-todo.ts      NewTodoCandidate, newTodo
   ├─ todo-patch.ts    TodoPatchCandidate, todoPatch
   └─ …                one file per business input, as the operations are laid out
```

`fields/` is private through the package's `exports` map (the story's
answer to Go's `internal/`, chapter 9). The public surface is
`problem.ts` and `<area>/<input>.ts`.

**What it refuses to know.** Words (a `Problem` carries a rule id and
parameters, never a message). Envelopes (no `hono`, `FormData`,
`argv`, headers). Anything impure (a session's liveness or an id's
existence is an operation's or middleware's job).

**Edges** (chapter 9): `handlers → valid`, `bff-api → valid`, later
`cli → valid`; `valid → business`. Operations and data never import
it. `valid` does not import `fail`: the delivery turns a `Problem` into
`Fail<"invalid">`, because the delivery owns the message `Fail`
carries.

### A delivery is a decoder, a message table and a present module

The handler's validate duty becomes three named lines:

```ts
// The body must be JSON, shaped as the contract says.        ← decode: the delivery's envelope
const body = await validateBody(c, AddTodoBody);
if (!body.ok) { return userFailure(c, body.error); }

// The title must follow the business rules.                   ← valid: shared
const input = newTodo({ title: body.value.title });
if (!input.ok) { return userFailure(c, invalid(input.error[0].field, apiMessage(input.error[0]))); }

// Adding can fail for the user (the list is full) or for us (the store).
const added = await addTodo(input.value);
…
```

- **api:** `validateBody` and `validateQuery` stay as the envelope
  step. `handlers/todos/validate.ts` goes; a `handlers/messages.ts`
  (rule id → the api's words) replaces its wording. The words must be
  the ones `prd/todo/api.md`'s examples show.
- **BFF:** the action fills a candidate from `FormData` and keeps its
  own `messages.ts`. `validate-title.ts` goes.
- **Present** is unchanged in stage 11; stage 12 gives the CLI its
  twin.

### Stage 12: the CLI on the same architecture

`apps/cli/`, a third deployable, role-named while there is one (A9).
Same two zones as the api.

```
apps/cli/src/
├─ index.ts            the story: config → construct → run(argv)
├─ config.ts           environment values, checked and frozen
├─ construct.ts        constructInfra → constructOperations → constructCommands → constructCli
├─ cmd.ts              our parser module: run(cli, argv) drives util.parseArgs behind it
└─ app/
   ├─ commands/        entry points: todos/add.ts, todos/list.ts, …
   │  ├─ decode.ts     argv → a candidate (the delivery's decode)
   │  ├─ messages.ts   rule id → the words this delivery uses
   │  └─ present.ts    success · created · userFailure · serverFailure → { stream, text, exitCode }
   ├─ probes/health.ts a readiness probe with its own ping() port
   └─ errors/          usage (unknown command or flag) and the unexpected throw
```

- `cmd.ts` is the twin of `http.ts`: the only file that knows the
  parser (Node's built-in `util.parseArgs`, no dependency). It
  registers the command table, the usage handler and the error
  handler, writes what a command returns to the right stream and sets
  `process.exitCode`. Commands take a plain `Argv` value from it.
- **The command template** is the handler template: decode (usage
  problems never reach `valid`), `valid`, operate the one unit,
  present.
- **Present:** a result to stdout as text, or as JSON with `--json`
  (field-copying presenters, D2); a failure to stderr with the root
  message for user kinds and `unexpected error` for server kinds, the
  chain only under `--verbose`. Exit codes are one table, compiler
  checked like `status`:

  ```ts
  const exitCode = {
    invalid: 64,      // EX_USAGE
    too_large: 65,    // EX_DATAERR
    not_found: 66,    // EX_NOINPUT
    limit: 73,        // EX_CANTCREAT
    unavailable: 69,  // EX_UNAVAILABLE
    server: 70,       // EX_SOFTWARE
  } satisfies Record<FailKind, number>;
  ```

  The codes are Claude's proposal; the owner chooses (Questions).
- **Construct:** the same four levels with the command table where the
  route table was. `constructCommands(operations)` gives each command
  its one unit. The entry chain reads
  `todo add → add → addTodo ⇢ AddStore.addTodoUnlessFull → …`.
- **The one real question is what `constructInfra` builds.** A CLI is
  either a *provider* delivery that runs the business operations over
  a data package it can reach (A2), or a *consumer* delivery like the
  BFF whose commands run UI-style operations over `data/internal/api`
  with plain `fetch` (chapter 8). A Node process cannot hold a D1
  binding, so a provider needs a data package it can reach:
  `data/sqlite` over `node:sqlite` against the local D1 file wrangler
  keeps under `.wrangler/state/v3/d1/`, or Postgres via
  `data/postgres`. A consumer needs `data/internal/api`, which is
  refactor B's package and does not exist yet (the client lives in
  `apps/bff/src/lib/server/api/`). Both roles use the same command
  template; only the unit construct hands it differs.
- **The spec, by symmetry:** `prd/todo/cli.md`, one section per
  command with flags, positionals, output, exit codes and worked
  examples (invocation → stdout, stderr, code), each citing its use
  case; a `tooling/cli-spec/` generating the options tables and
  `--help`, with `--check`. That is a stage of its own, after the CLI
  runs by hand.

What the CLI proves, if it works: `valid` is the sole authority for
rules across three envelopes; the four-duty template is independent of
Hono; construct is the only file that knows where the data is; a
delivery is a decoder, a message table and a present module.

## Next step: stage 11, `valid` as a deep module

1. **Read first:** this file; the files under What exists; story
   chapters 5, 7, 9, 13; the glossary's entries Validate once, Trusted,
   Anti-corruption layer; `prd/todo/api.md`'s validation examples.
2. **Check the branch.** Stage 11 works on `feat/valid-deep-module`,
   made from `main`. Confirm `main` contains `91da023` and whether
   `feat/tooling-api-spec` is merged; if it is not, stop and tell the
   owner, since `handlers/messages.ts` must match the spec's examples.
   `git fetch` fails in the sandbox; the owner's pull updates `main`.
3. **Present a plan, then the questions** (below). Do not write code
   before the owner has answered Q1–Q4 or said "you decide".
4. **Build in layers,** testing each tier as you go:
   - `packages/valid`: `problem.ts`, `fields/` (private via `exports`),
     one `<area>/<input>.ts` per business input that exists. Unit
     tests: one file per input, candidates in every envelope flavour
     (`true`, `"true"`, `"false"`, missing, non-string), every problem
     case first, the success case last. `valid` keeps its own
     `vitest.unit.config.ts` and runs in the node environment.
   - `apps/api`: `handlers/messages.ts`; each todos handler calls
     `valid` after its envelope step; `handlers/todos/validate.ts` is
     deleted. The api's integration tests and `pnpm check:api` stay
     green without touching the spec.
   - `apps/bff`: each action fills a candidate from `FormData`;
     `validate-title.ts` is deleted; `messages.ts` stays the BFF's.
     Run the Svelte autofixer on anything `.svelte` you touch.
   - `package.json` checks: `@todo/valid` lists only `@todo/business`;
     `@todo/operations` and `@todo/data-d1` do not list `@todo/valid`.
5. **Grep-checks to record** (profile-notes candidates): no
   `TITLE_MAX`, `TODO_LIMIT` or rule id outside `packages/business`
   and `packages/valid`; no `Context`, `FormData` or `argv` inside
   them; `fail` not imported by `valid`.
6. **Run** `pnpm check`, `test:unit`, `test:integration` and
   `test:e2e`, each in a fresh Bash command (Environment). Record the
   counts in the review tour.
7. **Write the story and glossary changes** (below), the review tour
   (`logbook/reports/2026-11-03-11-valid-review-tour.md`), and the
   profile-notes candidates. Commit when asked: one commit for the
   code, one `docs(logbook)` commit for the story, glossary, notes,
   tour and this handoff.

### Story and glossary edits for stage 11

Record the design as a numbered decision in the story's list at the
top, in the style of L26 ("agreed with the owner in the valid session,
2026-11-03"); L27 is the next number unless the owner numbers it. Then:

- **Chapter 5, Entry points:** the validate duty is three steps,
  decode (the delivery's envelope), `valid` (shared), word the problem
  (the delivery's message table). Replace the paragraph on
  `handlers/todos/validate.ts`. Keep A8's translation table and add a
  row: `valid` → a problem (rule id), the delivery → words.
- **Chapter 7, Business:** state the boundary: business is what is
  true (types, constants, pure functions); `valid` is how a candidate
  becomes an input; neither holds a message. Note why `valid` is not
  folded into business: D1 keeps business free of `fail`, and the
  owner keeps `valid` as the home of rule checks every delivery shares.
- **Chapter 9, Shape of the code:** add `valid` to the edge list and
  the zones; the three grep-checks.
- **Chapter 13, Failures, Who reads a message:** a message is written
  by the delivery that shows it; `valid` names the rule, the delivery
  the words.
- **Chapter 0:** `packages/valid` gets its line in the tree and the
  table.
- **Glossary:** add `delivery`, `candidate`, `decode`, `check`,
  `build`, `problem`, `rule id`, each with status *locked* once the
  code follows it; relate `check` to Validate once and `decode` to
  Anti-corruption layer.
- **Chapter 12** is retitled only in stage 12 ("other deliveries on
  the same architecture"), when the CLI exists.

### Questions to settle before stage 11 code

- **Q1. The name collision.** Business exports `newTodo(id, input)`,
  the entity behaviour; the natural name for the validator is the same
  word. Options: namespace imports (`valid.newTodo` beside
  `business.newTodo`), a verb (`toNewTodo`), or renaming the entity
  function. The owner names it.
- **Q2. The HTTP redundancy.** The contract schema checks `title` is
  text and `valid` checks it again a line later. Claude's proposal:
  keep `unknown` candidates and pay the microseconds, so `valid` is
  the sole authority for every non-HTTP delivery, with an L13-style
  comment at the top of `fields/` saying why. The alternative, typing
  candidates as `string | undefined`, makes the module shallower and
  returns the duplication to the deliveries.
- **Q3. All problems or the first.** Claude's proposal: `valid` returns
  every problem; the api shows the first (the envelope has one
  `field`), the BFF may show all. Confirm.
- **Q4. Form booleans.** Whether `flag` accepts `"on"` (a checkbox
  with no value) so the BFF needs no coercion of its own. Claude's
  proposal: yes, listed in `fields/` as the one form-specific
  spelling, with the reason.
- **Q5. Rule ids.** The scheme is the owner's: `title.empty`,
  `title.too_long`, `patch.empty` are Claude's placeholders. The ids
  are what use cases will cite, so they should be chosen once.
- **Q6. The decision number** for the story (L27 for `valid`, L28 for
  the CLI, unless the owner numbers them).

### Questions to settle before stage 12 starts

- **Q7. Provider or consumer.** A provider CLI runs `addTodo` against
  the store, which chapter 12 says the BFF must never do ("adding a
  todo has one authority, and it is the api"). Claude's reading: that
  rule guards the deployed path (a consumer must not bypass the api);
  a second *provider* of the same operations over the same store
  enforces the same rules, because the rules live in business and the
  operations, not in the api. The owner decides whether the story says
  so.
- **Q8. The data package** for a provider: `data/sqlite` over
  `node:sqlite` against wrangler's local D1 file (zero network, and the
  second adapter the owner planned; same engine, so it tests the
  driver layer, not the engine), or `data/postgres` (the target
  engine, needs a database). For a consumer: extracting
  `data/internal/api` from the BFF first, which is refactor B's first
  step.
- **Q9. Exit codes:** `sysexits.h` as proposed, or `0/1/2`.
- **Q10. The first command set:** `add`, `list [--completed]`, `done`,
  `undo`, `edit`, `remove`, `clear`, `health`, or fewer to start.
- **Q11. `--json`** output in stage 12 or later.
- **Q12. The CLI spec and `tooling/cli-spec/`:** a later stage, as
  proposed, or part of stage 12.

## Open, carried

Everything under "Open, carried" in handoff 10 still carries unchanged:
the final review over the slice tours' §10 items, the stage 06
close-out, and the deferred list. Added by this stage:

- The entry-chain index (L24) should list CLI chains once they exist;
  the index and its generator are still open.
- `profile-notes.md` still names `apps/todo/*` paths and holds none of
  L1–L26; a refresh is its own task, not this stage's.
- Chapter 12's "one authority" sentence, pending Q7.

## Environment

- `pnpm install` is the owner's to run. `pnpm -s` is not supported;
  use plain `pnpm`.
- `git fetch` fails in the sandbox. `claude.ai` and
  `sparrow.cloudflare.com` are blocked; this makes no difference.
  Wrangler's telemetry denials are harmless.
- **E2e:** run it once per Bash command. A second run in the same
  command fails with "The API is down" on `/health`. A fresh command
  always passes.
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
- Node is 26.13.0 and pnpm 12.5.1 (`engines`); `node` runs `.ts`
  files directly, as `tooling/` already relies on.
