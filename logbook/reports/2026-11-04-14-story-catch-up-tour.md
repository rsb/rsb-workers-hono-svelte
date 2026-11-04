# Review tour: stage 14 (the story catches up with the specs session), 2026-11-04

Claude wrote this tour of stage 14 for the owner to review against the
docs. It was written, not led live. Stage 14 is docs only. It records
the specs session's seven decisions as L29–L35, rewrites the seven use
cases in L30's form, and marks what stage 15 builds as **Target.**

The branch is `docs/story-specs-session`, made from `main` at `73017a6`
(PR #34 merged). It has three commits:
- `0806ec5` `docs(prd)`: the seven use cases.
- `235e344` `docs(logbook)`: the story and the glossary.
- the third `docs(logbook)` commit: profile notes P60–P63, the story
  delta line in handoff 00, handoff 14 and this tour.

Checks after the third commit, each in a fresh command. Nothing under
`apps/`, `packages/` or `tooling/` differs from `main`:
- `pnpm check` exits 0.
- `pnpm check:api` exits 0. `api.md` gains no `Applies:` lines, since
  no check reads them yet.
- `pnpm check:entry-chains` exits 0. It also passed after the use-case
  commit, because the index links each use case by file.

"Why" cites the questions of
[handoff 14](../handoffs/2026-11-04-14-story-catch-up.md) as Q1–Q4, and
the owner's answers:

| Q | Owner's answer |
|---|----------------|
| Q1 | The section names are `Refused`, `Guarantees` and `Given` |
| Q2 | No use-case id now; one comes with the triangle check |
| Q3 | "What makes a spec" is a section of chapter 11, moved out when the data spec is written |
| Q4 | L29–L35 for S1–S7; L28 stays reserved for the CLI |

The owner also decided:
- `todo.exists` is a state rule (`not_found`), applied by `updateTodo`
  and `deleteTodo`.
- Decode rules are not cited.
- The wire-only "completed" rule leaves clear-completed.
- "Set, never flipped" and "a field not given is left as it is" are
  effects.
- `valid`'s middle step is renamed **apply**, so "check" means only
  something that fails when code stops matching a spec.

## 1. The use cases

`prd/todo/use-cases/todos/*.md`, all seven in L30's form: Intent,
Serves, Input (Assumes), Given, Effects, Result, Refused, Guarantees,
Atomic.

- **What:** add-a-todo is handoff 14's template verbatim. The other six
  follow it:
  - **change-a-todo:** Assumes `patch.nonempty`, and `title.length`
    when a title is given. Given `todo.exists`. "Set, never flipped"
    is under Effects.
  - **remove-a-todo:** Given `todo.exists`.
  - **list-todos, clear-completed and mark-all-completed:** Guarantees
    `todos.order`.
  - **count-todos:** every section is none.
- **Why:** L30, L31, L33. A use case speaks the operation's language
  only, so trimming, the Enter key and the wire kinds left the files.
  A store failure is refused as "`unavailable` or `server`", the
  business kinds, not `internal`.
- **Changed without being asked:**
  - **One new id, `todo.exists`.** The handoff asked for any further id
    to be listed here. The owner accepted it as a state rule.
  - **"one statement" and "one transaction" became "one step"** under
    Atomic. The use case says what holds together, and how the store
    does it is the data spec's business.
  - **The Persistence citation left add-a-todo's Serves** along with
    the template. Persistence (deviation 3) is a guarantee of every
    store, not of this use case. The data spec is where it belongs.

## 2. The story and the glossary

`logbook/the-api-story.md` and `logbook/glossary.md`.

- **What:** L29–L35 at the top, each one entry in L26's style, then
  applied in the chapters named in the story delta (§4). Anything
  stage 15 builds is marked **Target.**: the rename to rule +
  violation, `Applies:`, the validator's `rules`, the route's
  validator, the join check, the rule table and the use-case lint.
- **Why:** handoff 14's chapter edits, and the owner's answers above.
- **The rename to apply.** L27 now reads "decode, apply, build". The
  tree in the story's opening, the steps in chapter 5, chapter 7's boundary and
  `fields/` bullets and the glossary changed with it. The glossary's
  Check entry under Validation is now Apply, with a "Not: check" note,
  and the new Specs › Check entry is the only meaning of the word. No
  code identifier is named `check`, so no code changed. The local
  `checked` was left.
- **Judgement calls:**
  - **"check rules" became "input rules"** (L27, chapter 7, glossary),
    L29's term. The doc comment in `packages/valid/src/problem.ts`
    still says "check rules". Chapter 7 says so, and stage 15
    regenerates that file.
  - **L27's "the enforcers" became "where rules are stated and
    applied".** Enforce is now narrowed to state rules, and `valid`
    applies input rules rather than enforcing them. P50 keeps "the
    enforcers", since it records stage 11 as built.
  - **The precedence item sits in chapter 11's Open**, beside L35. It
    goes into `AGENTS.md` only under a recorded rl-0009 exception. The
    auth item sits in chapter 6's Open.
  - **One glossary Open item was dropped:** "business rules vs
    validation rules". L29 settles it. Two were added: auth as
    subsystems, and branded input types (offered, not decided).
  - **Rule id moved** from the Validation section to Rules. It lists
    the ids specs cite today and `valid`'s current problem ids, with
    the rename marked target.

## 3. Profile notes, How we work, the handoff

- **P60–P63** in `logbook/profile-notes.md`, one each for S1 (L29), S3
  (L31), S5 (L33) and S7 (L35):
  - **P60, rule kinds:** checked approximately today by P50's grep
    checks; target: the rules index and the join.
  - **P61, three sources:** the use-case lint, not built. P61 says the
    citation belongs to the rule's definition, since a use case cites a
    rule by id only.
  - **P62, the join check:** not built.
  - **P63, address and check:** exact today for the api spec
    (`check:api`) and the index (`check:entry-chains`). The view has no
    check, so it is not yet a level.
- **Story delta in How we work.** Handoff 00's How we work gains a
  **Story delta** bullet. Later handoffs carry that section by
  reference, so the line lives there. Handoff 00 is merged, and its
  rule says a correction to a merged handoff goes in by its own small
  PR. Handoff 14 asked for this edit, so it is in this branch instead.
- **Handoff 14** is committed here. It was untracked until now.

## 4. Story delta

Chapters changed:
- **The opening:** L29–L35 in the decision list, and the tree's
  `valid/` line reads "decode, apply, build".
- **5, Entry points:** the entry point applies input rules only, and
  state rules are not its business. The L33 declarations are
  **Target.** beside the route helper.
- **6, Operations:**
  - L14's sentence is updated.
  - The L25 section is rewritten around L30–L32, with a new
    eight-row table, the three sources and the root and triangle.
  - "Business states" uses L29's wording.
  - The auth item is under Open.
- **7, Business:** the three kinds; input rules named; the rename to
  rule + violation and the rule table (L34) as **Target.**
- **8, Data:** guarantees are rules the store keeps.
- **9, The shape of the code:** the chain is rooted at the use case. The
  index keyed by use case and the triangle check are **Target.**, and
  the process map is under Open.
- **11, Contracts:**
  - The new section "What makes a spec (L35)".
  - `Applies:` and the join are **Target.**
  - L34's generation line is **Target.**
  - The Validation paragraph says "applies".
  - Precedence is under Open.
- **13, Failures:** a use case names failures in business kinds, and
  the delivery maps and words them.
- **Glossary:**
  - New: input rule, state rule, guarantee, violation, assumes, given,
    applies, and the Specs section (address, check, spec level,
    precedence).
  - Amended: rule, enforce, use case, entry chain, operation, spec,
    rule id, and Validation's Check, now Apply.

Not changed: chapters 0–4, 10 and 12. None of them names rules, use
cases or the three steps of `valid`.
