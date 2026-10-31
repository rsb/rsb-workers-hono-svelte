# Report: code exploration, architecture review and first refactor

Stage 03. The session ran across two days in one conversation:
- **2026-10-30:** the owner-led review.
- **2026-10-31:** the first refactor and the planning of slice 2.

This report records what happened, not whether it was right. Paths
are under `apps/todo/` unless they start with `logbook/` or `prd/`.

## 1. The session

| | |
|---|---|
| Kind | code exploration, led by the owner |
| Input | `logbook/handoffs/2026-10-30-02-slice-1-health.md`, the slice 1 report, `logbook/drafts/2026-10-30-02-slice-1-decisions.md` (C1–C5) |
| Owner's rules | "This is a code exploration session, and I lead it." Claude answers and explains, and does not start a tour, propose changes, or raise C1–C5 on its own. No code changes until asked. Each change is a small step the owner reviews, and is recorded in the decisions draft with what it changed in the code. |
| Outcome | R1–R9 recorded; `logbook/the-api-story.md` written; PR #6 merged; the handlers moved into the hierarchy zone (S1, S2); slice 2 planned |
| Not done | C2, C4, C5 review; refactor step 2 (construct, HTTP module, `index.ts`) |

## 2. The review (2026-10-30)

The owner explained the api's architecture as a whole, starting from
startup, instead of going through C1–C5 in order. Claude recorded each
point in the decisions draft as R1–R9 under "Review, session 03". Each
entry has a decision and a "Will change" line:

- R1 Startup has two halves (once per isolate, per request); the
  boundary is explicit.
- R2 `index.ts` tells the story: config, construct, wire. It delegates
  every step to our own deep module that drives Hono.
- R3 Config validates, maps and freezes environment values. Only
  `index.ts` and construct import it. `BODY_LIMIT_BYTES` stays a
  contract wire fact.
- R4 Construct builds every object from config. Only `index.ts`
  imports it.
- R5 Entry points follow a template with four duties: validate,
  operate, handle errors, present. This replaces C3.
- R6 Business is pure. Data is one package per real thing and maps
  business objects. Operations declare the interfaces they need, and
  construct injects data. This settles L5.
- R7 Two zones: the composition zone works by allow-list, and the
  hierarchy zone sits under one directory (Go's `cmd/` precedent).
- R8 Allowed edges between layers, the ancestor rule within a layer,
  layout as the hierarchy, depth 4 (5 at most). Checkable by an
  import scan (F14, P27).
- R9 Object style: Rust and Go, not Java.

C1 and C3 each got a "*Replaced at the review by …*" line. Twelve open
questions were recorded. C2, C4 and C5 were not reached.

## 3. The api story

The owner asked for "the-api-story.md", a chapter per layer, to be
filled in as features grow.
- Claude first created it at `api/the-api-story.md`. The owner said:
  "lets not mix it up with the code… put it in the logbook at the
  root".
- It moved to `logbook/the-api-story.md`, with ten chapters, each
  ending in an **Open** list.
- Claude added a line for it to the layout tree in `logbook/README.md`
  without being asked, and said so. The owner said "great".

Commits `b705ab1` (R1–R9) and `f36950b` (the story) were made on
`handoff/03-architecture-review`. The owner pushed, opened PR #6 and
merged it (`e742ce1`). Claude's first PR command was a multi-line
heredoc, which the owner found hard to copy. The single-line commands
that replaced it, copied with `/copy`, worked. The owner prefers
single-line commands.

No report or handoff was written at that point. This report and
handoff 03 cover both days.

## 4. The refactor (2026-10-31)

The owner asked for the code to follow the api story, with a limit:
"Don't try to invent parts that are not there. We have no config so
don't create a config package until we need it. Currently there is no
real operation or business for health and there are not inputs to
validate."

Claude split the work into two steps and did step 1 only:
- **Step 1, layout:** the handlers move into the hierarchy zone.
- **Step 2, composition (not done):** construct, our HTTP module and
  the story in `index.ts`.

How step 1 went:
1. **First layout, under `app/entries/`.**
   - Claude moved the handlers to `app/entries/<name>/<name>.ts` and
     `respond.ts` to `app/entries/present.ts`, the parent every child
     shares.
   - It removed `routes/health.ts`, which ended the cousin import.
     `app.ts` bound `GET /health` itself.
   - It moved the unit test to mirror the source.
   - It recorded the move as S1 and listed the choices for the owner
     to check: the name `app/`, a directory as a package, presentation
     in the parent, the failure handlers as entry points, and no
     template yet.
2. **`app`, and `handlers` for the layer.** The owner: "I like app I
   think that is an appropriate name, but I think since handlers is
   so widely used and accepted we should use that as the root of our
   entry points."
   - Claude agreed, for three reasons: R5 already says it; Hono's and
     Go's handler types use the word; and `entries` reads like data
     once todos arrive.
   - It noted one cost: in Hono, middleware is also a handler. The
     owner: "when we get to middleware we can name it middle or
     something like that." Claude suggested `middleware`, as the
     better-known word, and left the choice to the owner.
3. **One parent for the error handlers.** The owner: "error,
   not-found and too-larg are related I think they only need one
   parent error(s)".
   - Claude proposed one package with one file, `errors/errors.ts`,
     instead of a parent with three one-line children. Its reasons:
     the three share a reason to change and have no dependencies, and
     `errors` is also a Go standard-library name.
   - The owner: "yes I agree. good call".
4. **Recorded.** Claude rewrote S1 to the final layout and added S2
   (the layer is named `handlers`, which changes R8's edge list). The
   story's edge list and chapter 5 changed to match.

Resulting layout:

```
api/src/
├─ index.ts              unchanged
├─ app.ts                still wires Hono; imports the handlers
└─ app/handlers/
   ├─ present.ts         was respond.ts
   ├─ health/health.ts
   └─ errors/errors.ts   notFound, tooLarge, onError
```

The owner then stopped the refactor: "This is as far as I want to
take the refactoring right now. There are still many changes to make
but they can be done when there is more complexity where it will make
more sense."

Checks after each move: `@todo/api` `check`, `test:unit` (1) and
`test:integration` (3) passed. Each wrangler run tried to reach
`sparrow.cloudflare.com` (telemetry, P23). The sandbox blocked it, and
the run only logged it.

## 5. Planning slice 2

The owner asked about the next feature. Claude described:
- slice 2 (Add and list), its routes, deviations 3, 7 and 9, and its
  eight scenarios;
- what slice 2 brings to each part of the story;
- the open questions it forces: 3, 5, 6, 7, 9 and 12 (C4), plus who
  assigns the `id`.

The owner's instructions for the next session:
- Claude settles the open questions, notes them, and presents them
  back in a review tour, "so we see the api story evolves to handle
  this new complexity".
- Claude does its best to see where the api story fits the BFF
  ("after all bff is half api"). The owner will have more say on the
  BFF later.
- The Svelte plugin is available for Svelte code.

## 6. Commits

On `handoff/03-api-refactor`, local only:
1. `refactor(api): move handlers under app/handlers per the api story`.
   It holds the code, the decisions draft (S1, S2) and the story.
2. `docs(logbook): report stage 03 and hand off slice 2`. It holds
   this report and handoff 03.

The owner pushes and opens the PR.
