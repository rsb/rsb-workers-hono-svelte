# Handoff 03: architecture review and first refactor, 2026-10-31

The owner reviewed the api's architecture (R1–R9), and the review
became `logbook/the-api-story.md`. The handlers moved into the
hierarchy zone (S1, S2). The next session builds slice 2 (Add and
list) on the story, settles the open questions as it goes, and ends
with a review tour.

This file, handoffs 02, 01 and 00, and the stage 03 report are the
input the next session starts from. Handoff 00's Purpose, How we work,
Sources, Fixed inputs and Testing policy still apply unless a later
handoff changes them.

## What exists

- **Code** (this branch), under `apps/todo/`:
  - `api/src/index.ts`: `export default createApp()`, unchanged.
  - `api/src/app.ts`: the Hono chain `bodyLimit` → `.get("/health")`
    → `notFound` → `onError`. It imports the handlers directly, which
    is general importing specific (still an R8 violation).
  - `api/src/app/handlers/`:
    - `present.ts`: was `respond.ts`; the parent, shared by every
      handler.
    - `health/health.ts`: `getHealth`.
    - `errors/errors.ts`: `notFound`, `tooLarge`, `onError`.
  - Tests: `api/test/unit/app/handlers/errors/errors.test.ts`, plus
    the three integration tests, unchanged.
  - Contract and web: unchanged since slice 1.
- **Logbook:**
  - `drafts/2026-10-30-02-slice-1-decisions.md`:
    - C1–C5, with C1 and C3 replaced;
    - "Review, session 03": R1–R9 and open questions 1–12;
    - "Refactor, session 03": S1 (layout) and S2 (the layer is
      `handlers`).
  - `the-api-story.md`: ten chapters, each with an **Open** list. It
    says how far the code follows it.
  - `reports/2026-10-31-03-code-exploration-architecture-review.md`:
    what happened across both days.

Checks at commit: `pnpm check`, `test:unit` (8 + 5 + 1) and
`test:integration` (3) exit 0. `test:e2e` was not run, because the web
did not change.

## Changes from handoff 02

- **The api's architecture is R1–R9 and the api story** (owner). They
  replace C1 and C3. The story is the living document: each slice fills
  its chapters and moves settled items out of its **Open** lists.
- **Layout** (owner, S1–S2):
  - The hierarchy zone is `src/app/`. Its first layer is
    `app/handlers/`.
  - "Entry point" names the role, and `handlers` names the directory.
  - Middleware will get its own name when it has a home. The owner
    said "middle or something like that"; Claude suggested
    `middleware`. Not settled.
- **Refactor step 2 is deferred** (owner): "There are still many
  changes to make but they can be done when there is more complexity
  where it will make more sense." That means construct, our HTTP
  module and the story in `index.ts`.
- **Commands for the owner** are single lines, one per code block, so
  `/copy` picks each one up.
- **The Svelte plugin** is available (MCP `svelte-autofixer`,
  `get-documentation`; skills `svelte:svelte-code-writer`,
  `svelte:svelte-core-bestpractices`; agent `svelte:svelte-file-editor`).
  Use it for every `.svelte` and `.svelte.ts` file, and run the
  autofixer until it is clean.

## Next step: slice 2, Add and list

The working agreement is the same as for slice 1 (owner, 2026-10-31):
Claude settles the open questions, builds on them, and then presents
them back in a review tour, "so we see the api story evolves to handle
this new complexity".

Order:

1. **Read first.** Read this file, the stage 03 report, the api story,
   the decisions draft and `prd/todo.md` (API, Envelope, Shape,
   scenarios 2.1–2.8).
2. **Decisions draft.** Write `logbook/drafts/2026-10-31-04-slice-2-decisions.md`
   before any code. Settle every question listed under "Questions to
   settle" below. Each entry gives the decision, the reason, and what
   it constrains in the code, so the tour can check one against the
   other. Number entries D1, D2, … and cite the question each one
   answers.
3. **Slice draft.** Write `logbook/drafts/2026-10-31-04-slice-2-add-and-list.md`:
   the plan per package, and a section at the end for where the code
   had to differ from the draft.
4. **Build** contract, api and web, all three test tiers (C5 still
   stands until reviewed). Refactor step 2 is part of the build, as the
   first injection needs it. Do not build ahead of the slice: config
   stays absent unless an environment value appears.
5. **Update the api story.** Fill in each chapter the slice touches.
   Move settled items out of **Open**, and add new open items as they
   appear.
6. **Write the BFF story** (see below) as Claude's first pass.
7. **Run every check.** `pnpm check`, `test:unit`, `test:integration`,
   `test:e2e` (with the F9 workaround if the browser is still missing),
   and `pnpm test` exits 1. Run `pnpm dev` and confirm the flow works
   through the binding.
8. **Write findings** in `logbook/findings/02-add-and-list.md`, and
   update profile-notes.
9. **Review tour**, led by Claude this time, in story order:
   startup → `index.ts` → construct → handlers → operations →
   business → data, then the BFF.
   - At each stop, show the code, the decision (D-n) and what changed
     in the story.
   - The owner reviews. A decision the owner changes is recorded in
     the decisions draft with what it changed in the code.
   - Changes during the tour are small steps the owner reviews.
10. **End of session.** The report goes in `logbook/reports/`, then a
    local commit, then handoff 04. The owner pushes and opens the PR.

### Questions to settle

The numbers are those in the decisions draft ("Open, raised in the
review"). S1 settled 1 and 2 for now, without privacy, and placed
presentation (half of 5).

- **3. Contract wire shapes vs business types.**
  - Does business import contract (for the title limit, which must be
    defined once), or does the handler map wire → business?
  - Is `Todo` one type or two?
- **4. Where our HTTP module sits.** Today it is `app.ts` in the
  composition zone. Where do handlers get Hono's types?
- **5. Where validation sits** (presentation is in
  `handlers/present.ts`). The current dependency is
  `@hono/valibot-validator`, the owner's choice (P25). Does R5's
  "validate" duty use it, or plain valibot inside the handler?
- **6. Siblings within a layer.**
  - `addTodo` and `listTodos` share a store interface. Does that sit
    in a parent `operations/todos/`?
  - Can a todos handler share `present.ts` and a todos parent of its
    own?
- **7. Cross-layer depth.** Can a handler import any operation
  package, at any depth?
- **8. Where a depth-5 reason is recorded**, if one comes up.
- **9. Object style** with something to inject: classes as structs,
  or constructor functions returning plain objects? Also `this` when
  a method is handed to Hono.
- **10, 11. Config.** If none appears, say so in the story and
  leave it out.
- **12. C2, C4, C5.**
  - C4 (`Result`) is now a layering question. The PRD says
    request-path errors are returned values, and `limit` (409) is the
    first operation error. Where does `Result` live, and how does a
    handler turn it into an envelope?
  - C2: does health still ignore the store?
  - C5: still no web integration tier?
- **New: who creates a todo.** Where `id` (`crypto.randomUUID`?) and
  creation order come from: business, operation or store. R6 says data
  only maps business objects.
- **New: the 500 cap (deviation 9).** Is it a business rule, an
  operation check or a store check, and is it defined in contract?
- **New: where the store lives across requests.** It must be built
  once per isolate (R1's first half) for scenario 2.8. The story
  should say that the state is per isolate, which is all local dev
  has.
- **New: middleware's home.** It is the per-request half. Today that
  is only `bodyLimit`. Settle the name if anything moves.

### The BFF story

The owner: "do you best to see where the api story also fits for the
bff story, after all bff is half api." The owner will have more say on
the BFF later, so this is Claude's first pass, and the file says so.

Write `logbook/the-bff-story.md` with the same chapters as the api
story where they fit. Mark where SvelteKit decides for us, and add a
chapter where the BFF has a part the api does not. Starting points to
test against the code, not settled:

| api story | candidate in the BFF |
|---|---|
| Startup, two halves | `hooks.server.ts` (`init` once, `handle` per request) |
| `index.ts` tells the story | none of ours; SvelteKit owns the entry. Is `hooks.server.ts` the nearest place? |
| Config | `env` from `cloudflare:workers` (the `API` binding) |
| Construct | build the API client from `env.API` once |
| Entry points, four duties | `load` and form actions: validate form data with contract limits, operate, map a `Failure` envelope to `fail(4xx)`, present page data |
| Operations | BFF use cases (add a todo; later, filtering `/` in the BFF, slice 8) |
| Business | shared with the api, from contract, or its own? |
| Data | the api, reached through the binding, is the BFF's one "real thing"; the client maps envelopes to business objects. `readHealth` today mixes entry point and data. |
| (none) | the page itself: `.svelte` components, a presentation layer the api lacks |
| Layout is the hierarchy | `src/routes/` is fixed by file-based routing, so the hierarchy rules apply to `src/lib/` |

## Open, carried

- **Tour points from handoff 02 not yet in findings** (report 02 §4):
  - `onError` turns `HTTPException` into a 500.
  - The non-validation kinds are listed twice in the contract.
  - `success` data is not tied to the contract type.
  - The `console.error` stub is never restored.
  - The `bodyLimit` streaming path is untested.
  - A 2xx `Failure` has no web test.
  - Handler types are mixed.

  Slice 2 touches most of these. The decisions draft says which ones
  it settles.
- **Open findings:** F2, F4, F5, F7, F9, F11, F13.
- **Playwright browser (F9, P35):** the owner's shell should run
  `pnpm --filter @todo/web exec playwright install chromium` once.
- **Carried from handoff 01:** P19 request-path catalogue (later
  iteration), P23 telemetry, P12 debt baseline.

## Environment

Unchanged from handoff 02, plus:
- **pnpm:** use `~/.local/share/pnpm/bin/pnpm`, not the one on PATH.
- **`.git/config` is not writable in the sandbox.** `git branch -m`
  renames the branch but cannot update the config. Upstream tracking
  is set by the owner's `git push -u`.
- **Wrangler telemetry** to `sparrow.cloudflare.com` is blocked and
  only logged (P23).
- **Placeholder dotfiles** at the root (`.bashrc`, `.idea`,
  `.mcp.json`, …) are untracked sandbox artefacts. Never commit or
  ignore them, and stage by explicit path.
