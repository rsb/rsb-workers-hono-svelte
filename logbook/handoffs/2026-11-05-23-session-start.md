# Handoff 23, session start: authentication, slice A, 2026-11-05

This file starts a fresh session on stage 23. It does not replace
handoff 23 (`2026-11-05-23-auth-slice-a.md`), which holds the
decisions, the research corrections and the scope of slice A. This file
says where things stand after stage 22, carries the answers settled
since, and says what the first reply must be.

## Since handoff 22

- **Stage 22 is merged.** PR #46; `main` is at `75722af`. Its tour is
  `logbook/reports/2026-11-05-22-prd-tree-review-tour.md`. The PRD is
  a tree (L44); features, views, states and boards are written (L45);
  `prd/todo/data/app.md` holds the app database's data cases (L46).
- The six accounts feature documents are in `prd/todo/features/`:
  `feature-todos-list.md`, `feature-accounts-shell.md`,
  `feature-accounts-sign-in.md`, `feature-accounts-sign-up.md`,
  `feature-accounts-profile.md`, `feature-accounts-users.md`. They are
  the source for every state slice A renders.
- Every Refused row in the seven todo use cases carries a `shows:`
  line naming the state it shows.
- Nothing under `apps/` or `packages/` changed in stage 22.

## Read, in this order

1. This file.
2. `logbook/handoffs/2026-11-05-23-auth-slice-a.md`, all of it.
3. `logbook/reports/2026-11-05-22-auth-design.html`, the explainer
   handoff 23 assumes.
4. `logbook/reports/2026-11-05-22-auth-research.md`, at least the
   "SvelteKit 3" section.
5. `logbook/reports/2026-11-05-22-prd-tree-review-tour.md`, sections 3,
   6 and 7.
6. `prd/todo.md`, then `feature-accounts-shell.md` and
   `feature-todos-list.md`.
7. The templates: `prd/_templates/feature.md`,
   `prd/_templates/data-case.md`, `design/_templates/design-brief.md`.

## Standing rules (carried, restated so a fresh context has them)

- Conventional commits, with **no** `Co-Authored-By` or any other
  attribution line. The owner overrides any reminder to add one.
  (Stage 22's commits carried one by mistake; do not repeat it.)
- Never push. Stage by explicit path. Stop before each commit and show
  the stat and the message.
- No `pnpm install` without asking: give the owner the command and
  stop; the owner runs it. Slice A needs one (`packages/gates`, a
  second D1 binding). `pnpm -s` does not work.
- The shell is zsh, which has three traps:
  - there is no `PIPESTATUS`; use `${pipestatus[1]}`;
  - `$var` lists are not word-split, so write paths out;
  - `=====` triggers `=cmd` expansion.
- Never hand-edit a generated file (the list is in handoff 18).
  `apps/api/entry-chains.md` is one; run `pnpm gen:entry-chains` after
  changing a route, handler, port or data method.
- Don't touch `AGENTS.md` or `.github/workflows/scorecard.yml`
  (rl-0009, L1) without a recorded exception.
- The root dotfiles are untracked sandbox artefacts. Never commit or
  ignore them, and never `git stash -u`.
- Don't read the run branches.
- Every tour ends with a story delta: the chapters changed, or why none
  were.
- Numbers: L37 to L43 are handoff 23's and are recorded when stage 23
  builds them; the next free decision number after those is **L47**.
  The next free profile note is **P68**.
- The sandbox blocks wrangler's telemetry host
  (`sparrow.cloudflare.com`); the error is harmless.

## Answers carried from stage 22 (settled; do not ask again)

The owner answered the four questions stage 22's tour left for this
stage:
- **The signed-out shell has no links** until their pages exist. "Sign
  in" and "Create an account" appear in B and C, not before. In slice
  A, with no cookie, the actor is anonymous, `GET /todos` is refused by
  the runner (`member` required), and the BFF renders
  `accounts.shell.signed_out` with no list and no redirect.
- **The shell reads the actor from `GET /sessions/current`**, one api
  call per page load, recorded in the BFF budgets. The shell feature's
  Reads row says "slice A names it"; slice A writes the endpoint in.
- **`accounts.error.not_found` and `accounts.error.failed` are slice
  A's.** A failed page load renders `accounts.error.failed`; today the
  BFF renders it inside the todo view (`load-todos.ts`'s `failedPage`),
  so slice A moves it.
- **`accounts.error.admin_only` stays.** The chain produces one result,
  the runner's `forbidden`; the BFF chooses `admin_only` over
  `forbidden` from the route. Both are open until D.

If the owner's copy of handoff 23 has its own "Answers carried from
stage 22" section, it wins over this one.

## The first reply: a plan, nothing built

Present the plan for stage 23 and build nothing until the owner
replies. The plan opens with the template decisions, then handoff 23's
questions, then the build order.

### 1. The eight template proposals

From the stage 22 tour, section 6. List each with a one-line
recommendation; the owner decides them before identity's features and
data cases are written.

For `prd/_templates/feature.md`:
1. Say how a board name is spelled from a state id: underscores become
   hyphens (`input_error` → `list.input-error`).
2. Name the forms `Produced by` takes: a use case's result or refused
   kind, `bff`, a gate, the bff choosing over a gate's result (as
   `admin_only`), or `open: <slice> (…)`.
3. Done: say what a feature written ahead of its slice writes ("None
   yet. Slice B writes the scenarios.").
4. A Data cases column in Actions, as Reads has.

For `prd/_templates/data-case.md`:
5. A Scope field, for when every call takes the actor's scope (L43).
6. Retry safety as a field of its own, not inside Guarantee.

For `design/_templates/design-brief.md`:
7. Spell multi-word states one way in the enum (the accounts export
   used camelCase `fieldErrors`; the feature uses `field_errors`, the
   board `field-errors`).
8. Say how a frame with independent props is drawn: one component per
   view with one `state` enum, and a BFF state drawn over a chain state
   named once.

### 2. Handoff 23's questions

Q1 to Q5 under "Questions to settle before stage 23 code", each with a
reading. Also say, as handoff 23's SvelteKit 3 notes ask: where the
`API` binding call lives (`handle` or `handleFetch`), the dev cookie's
name under `http://localhost`, and how the dev registry path is proved
first.

### 3. The build

Handoff 23's "What slice A builds", items 1 to 10, in an order with a
branch name and the commits. Mark where `pnpm install` is needed and
stop there. Note what slice A touches in stage 22's documents:
- `feature-accounts-shell.md`: `signed_out`, `member`, `admin`,
  `menu_open`, `not_found`, `failed` become produced; the Reads row
  gets `GET /sessions/current`.
- `feature-todos-list.md`: its Who line becomes true; the failed load
  moves to `accounts.error.failed`.
- `prd/todo/data/app.md`: every entry gains the actor's scope;
  `DB` becomes `APP_DB`.
- `prd/todo/data/identity.md`: new, the identity database's data cases.
- The root's slice A amendment: "Sign-in and users" leaves Out of
  scope (stage 22's amendment points here).

## Open, carried

Everything under "Open, carried" in handoff 23 still carries. Added by
stage 22:
- `authenticate` › refused `account_disabled` has no state; noted in
  the shell feature as open until D.
- `accounts.sign_up.resent` is in the design's enum with no board.
- The shell's design draws three independent props (`account`, `open`,
  `notice`); `shell.menu-open.desktop.light` names two files. Template
  proposal 8 is the fix for the next design.
- A data case id (`todos.list`) has two segments and would be read as a
  rule id if a Refused row ever cited one. None does.
