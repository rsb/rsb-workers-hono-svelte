# Handoff 14: the story catches up with the specs session, 2026-11-04

Since handoff 13:
- **Stage 13, the route table as data, is built**; its tour is
  `logbook/reports/2026-11-03-13-route-table-review-tour.md`. Read it
  for the current shape of `route(…)`, the index and the CI changes
  before editing chapter 9, since this handoff builds on both.
- **The owner and Claude held a specs session in the planning chat**
  (2026-11-04). It settled how rules, use cases and specs relate, and
  the story now lags it in chapters 5, 6, 7, 9, 11 and 13 and in the
  use-case form. This stage brings the story, the glossary and the
  seven use cases up to date. It writes no application code.
- The session also designed a rules spec that generates the business
  rule table and `valid`'s validators. That is **stage 15**, outlined
  at the end; this stage records it as a target, builds none of it.

The next session starts from this file, handoffs 13 to 00, and the
reports. Handoff 11's Rules and Environment apply unchanged.

## Rules for a docs stage

- A decision is recorded once, in the story's list at the top, in the
  style of L26 ("agreed with the owner in the specs session,
  2026-11-04"), and then told where it applies. Chapters say what the
  code does today and mark **Target.** for what a decision asks for
  beyond it; do not describe the rules stage as if it existed.
- The decisions below are numbered S1–S7 *in this handoff only*. Check
  the story's list for the next free L number (stage 13 may have
  recorded its own) and assign L numbers in this order. L28 stays
  reserved for the CLI unless the owner says otherwise.
- Edit only the chapters named. Keep every paragraph you are not
  changing word for word; targeted changes stay targeted.
- The use cases are rewritten in the new form (below), one commit for
  all seven. Their rule ids are the rule ids S5 defines, even though
  `valid` still carries stage 11's problem ids; the story records the
  rename as a target of stage 15.
- `AGENTS.md` is not touched (rl-0009); the precedence rule in S7 is
  recorded in the story and listed under Open for a later exception.

## The decisions to record

**S1. Rules have three kinds, and the kind says where a rule is
applied.** An *input rule* is a property of the input alone, decidable
with no world state; it is applied once, at the entry point, through
`valid`, and everything below assumes it (`title.length`,
`patch.nonempty`). A *state rule* is a property of the world plus the
input; it is applied only where the world is read and written
atomically: the operation, with the store keeping the step together
(`todos.cap`). A *guarantee* is a promise the store makes
(`todos.order`, `todo.id`). This narrows L1's wording: business states
rules; the entry point applies input rules, once; the operation applies
state rules; the store keeps them atomic and provides guarantees.
Applies to chapters 5, 6, 7, 8.

**S2. A use case is a state transition, and speaks only the
operation's language.** Its sections are Intent, Serves, Input (what
the input already satisfies, by rule id: assumed, not applied), Given
(the state rules the operation applies), Effects, Result, Refused (in
business failure terms: `invalid`, `not_found`, `limit`,
`unavailable`, `server`, never the wire's), Guarantees (what the store
promises), Atomic (what holds together). No delivery words (no Enter
key, no form, no trimming) and no wire kinds. How the input came to be
is the delivery's spec. Replaces the form in L25; the seven use cases
are rewritten. Applies to chapter 6.

**S3. A rule cites one of three sources, and an uncited rule is a lint
failure, not a forbidden thing.** A PRD line or deviation (what the
product demands); a recorded decision, story chapter or registry entry
(what the system demands); or an interview answer from the owner,
which must become one of the first two before the use case is
approved, otherwise it sits under `Open:`. The agent may propose a
rule; it enters a spec only with a citation. Applies to chapter 6 and
the use-case lint (target).

**S4. The use case is the root of the entry chain.** An entry point is
where a delivery attaches to it (`POST /todos` and, later, `todo add`
both hang from `add-a-todo`); a probe is rooted at a PRD requirement
instead. The index is keyed by use case and lists its entries per
delivery, its unit, port and data. Three sources state one edge each of
a triangle, and the index joins them: the api spec's `Serves:` (route →
use case), construct (route → unit), the unit's doc comment (unit → use
case); a mismatch is drift. A process use case's steps are use cases,
so the same index read one level down is the process map. Amends L24.
Applies to chapters 6 and 9.

**S5. Specs cite rules by id only, and the code carries what it
applies as data.** A rule id names the rule (`title.length`); a problem
carries the rule and the violation (`empty`, `too_long`), and message
tables branch on the violation. A use case declares `Assumes:` (under
Input) and `Given:`; an endpoint in `api.md` declares `Applies:`; a
validator exports the rules it applies (`toNewTodo.rules`); a route
declares its validator (`route({ postTodos }, { addTodo }, { toNewTodo })`).
The check joins them: `Applies ⊇ Assumes` for every endpoint serving a
use case, the route's validator's `rules` equals `Applies`, every cited
id exists. Input rules are proven structurally by that join; state
rules behaviourally, by a named test per `Given` id, read from the
test runner's report. A spec never states a rule's wording or number;
the definition has one home. Refines L27 (the ids) and stage 13 (the
route helper). Applies to chapters 5, 9, 11. **Target** until stage 15.

**S6. A rules spec is the source of inputs, rules, constants and
violations** (`prd/<app>/rules.md`, in the api spec's vocabulary
style). Generated from it: the business rule table and constants
(`packages/business/src/rules.ts`), the validators for input rules,
the `Problem` union, and a rules index with `--check`. Hand-written
still: entity behaviour, operations, stores, the message tables, and
any rule marked `custom`, which the generator only checks exists and
exports its id. This moves the generation line: chapter 11's "generation
stops at the contract" becomes "generation stops at the validators and
the rule table"; operations, business behaviour and data stay by hand.
Agreed in principle; **confirmed by stage 15**, which regenerates stage
11's four validators as its proof. Applies to chapters 7, 11.

**S7. A formalization is a spec level only when it has an address and
a check.** An id something else can cite, and a check that fails when
the code stops matching it. Without the address it cannot be linked;
without the check it drifts and is then worse than no spec. Precedence
when a spec and the code disagree: for generated artefacts the spec
wins and the artefact is regenerated; for hand-written code the code
wins and the spec is corrected; the generated indexes are the arbiter.
The levels and what binds each:

| Level | States | Bound by |
| --- | --- | --- |
| PRD | the need, product rules | the use-case lint (every rule cites a source) |
| use case | one unit: input, given, effects, result | the entry-chains index, the triangle |
| api spec | the wire | `gen:api --check`, the examples replayed |
| rules spec | ids, parameters, kinds, violations | generated validators and table; cited ids exist |
| data spec | what a store call guarantees | the conformance suite |
| view | what a page composes | nothing yet, so not yet |

Applies to chapter 11, as a new section "What makes a spec", and to the
glossary.

**Also to record, as open, not decided:** authentication (is this
caller allowed in) and authorization (what may they do, under an ACL or
attribute policy) are subsystems that steer the flow of code at run
time, modelled in their own session; they are not rule kinds. What they
touch now: the operation descriptor in the route table will carry
`kind` (read or write) and `resource`, minted in the use case, read by
the authorization subsystem. Chapter 6, Open.

## The use-case form, with `add-a-todo` rewritten

All seven files in `prd/todo/use-cases/todos/` take this form. The
example is the template; where a section is empty for a use case it
says `none`.

```markdown
# Add a todo

## Intent
Append a new, active todo to the list.

## Serves
- `prd/todo.md` › Functionality › New todo, as evidence of the need. Its
  wording ("pressing Enter", "`.trim()`") belongs to the deliveries'
  specs, not here.
- Deviations 7 and 9; scenarios 2.3–2.8.

## Input
- A `NewTodo`: a title. Assumes `title.length`.
- A fresh id from the id source (D13).

## Given
- `todos.cap`: the list holds fewer than `TODO_LIMIT` todos.

## Effects
One todo is stored: active, with the given id, last in creation order.
No external effects.

## Result
The stored todo.

## Refused
- `todos.cap` does not hold: `limit`. Nothing is stored.
- The store fails: `unavailable` or `server`. Whether the todo was
  stored is not known to the caller.

## Guarantees
- `todos.order`: lists are in the order todos were added.
- `todo.id`: no two todos share an id.

## Atomic
The count and the insert are one step: two adds at 499 cannot both
land (deviation 9).
```

Note what left the file: the title rule as something the operation
enforces (it is assumed, by id), trimming (decode), and the
`validation` failure on the title (the entry point's, shown in
`api.md`'s examples). The rule ids to use across the seven files:
`title.length`, `patch.nonempty`, `todos.cap`, `todos.order`,
`todo.id`; name any further one the files need and list it in the
tour.

## Chapter edits

- **Top of the story:** the new L entries (S1–S7 in order), each one
  sentence with its chapters, in the existing style.
- **Chapter 5, Entry points:** under Validate once, the three-step
  validate duty from L27 gains the rule kind: the entry point applies
  input rules; state rules are not its business. Add the S5 declaration
  (`Applies:` in the spec, the validator's `rules`, the route's
  validator) as **Target.** beside the stage 13 route helper.
- **Chapter 6, Operations:** rewrite "Use cases are written before the
  code (L25)" around S2 and S4: the use case form, the use case as the
  root, the triangle, processes as nested use cases. Replace the
  in-use-case / in-unit table with the new sections. Add S3's three
  sources. Under "Business states, the operation enforces" apply S1's
  wording. Add the auth note to **Open.**
- **Chapter 7, Business:** S1's kinds; the rule table as **Target.**
  (S6): `business/rules.ts` is where a rule has its words, numbers,
  kind, violations and source, generated in stage 15, and the one place
  a rule is defined.
- **Chapter 8, Data:** guarantees are rules of kind `guarantee`
  (`todos.order`, `todo.id`); the data spec's entry cites them.
- **Chapter 9, Shape of the code:** "Following an entry chain (L24)"
  becomes rooted at the use case (S4): the one-line form stays, the
  index block starts with the use case and lists entries per delivery.
  Say that the index is generated by stage 13's tooling and what S4
  adds to it as **Target.**
- **Chapter 11, Contracts:** a new section "What makes a spec" carrying
  S7 (the table, precedence); under "The api spec defines the api",
  the `Applies:` line as **Target.** (S5); under "Generated from it",
  the generation line as S6 words it, with the rules spec as
  **Target.**
- **Chapter 13, Failures:** a use case names failures in business
  kinds, never wire kinds (S2); the delivery words them (L27).
- **Glossary:** add `input rule`, `state rule`, `guarantee` (under
  Rules), `rule id`, `violation`, `assumes`, `applies`, `given`,
  `address`, `check`, `spec level`, `precedence`; amend `Rule`,
  `Enforce` (narrowed to state rules; input rules are *applied*),
  `Use case` (the new sections), `Entry chain` (rooted at the use
  case). Status `target` on anything stage 15 realizes.
- **profile-notes:** candidates for S1 (rule kinds), S3 (three
  sources), S5 (declarations and the join), S7 (address and check,
  precedence), each with its check named.

## Keeping the story current from here

Add one line to How we work (handoff 00's section, carried by every
handoff): every stage's docs commit includes a **story delta** in its
tour, listing the chapters changed or saying why none were. A stage
that changes behaviour the story describes and leaves the story alone
is not done.

## Next step: stage 14

1. **Read first:** this file, the stage 13 tour, story chapters 5–9,
   11, 13, the glossary, the seven use cases, `prd/todo/api.md`.
2. **Branch:** `docs/story-specs-session` from `main`. Confirm `main`
   holds stage 13's merge; if not, stop and tell the owner.
3. **Present a plan, then the questions** (below). Do not edit before
   the owner answers Q1–Q3 or says "you decide".
4. **Edit** in this order, one commit each when asked: the seven use
   cases; the story and glossary; profile-notes and the tour
   (`logbook/reports/2026-11-04-14-story-catch-up-tour.md`, with the
   first story delta).
5. **Check** `pnpm check` still passes (nothing in code changed) and
   `pnpm check:api` is untouched: `api.md` gains no `Applies:` lines
   this stage, since no check exists for them yet.

### Questions to settle first

- **Q1.** Section names in the use case: `Refused` for failures,
  `Guarantees` for the store's promises, `Given` for state rules, as
  above, or the owner's words.
- **Q2.** Whether use cases get a stable id beside the slug now
  (S4's triangle is more robust pinned to an id than to a filename), or
  when the rules stage adds the check. If now, the scheme is the
  owner's.
- **Q3.** Whether S7's "What makes a spec" is a section of chapter 11
  or a chapter 14 of its own.
- **Q4.** The L numbers (after reading the list).

## After this: stage 15, the rules spec (outline, not started)

- `prd/todo/rules.md` in the api spec's vocabulary style: an Inputs
  section (fields, types, `trimmed`, `optional`, the rule each field
  carries) and a Rules section (id, kind, statement with named
  parameters, values, violations, source).
- `tooling/rules/`: parse, emit `packages/business/src/rules.ts`,
  emit `packages/valid/src/<area>/<input>.ts` and `problem.ts`, emit
  the rules index; `--check` for all four; `custom` as the escape
  hatch.
- The proof: stage 11's four validators regenerated and their 53 tests
  unchanged.
- Then `Applies:` in `api.md`, `Assumes:`/`Given:` already in the use
  cases, the route's validator, and the join check; a named test per
  `Given` id.
- Questions it will ask: where the rule's words live (the spec, as
  proposed) and whether the message tables stay fully hand-written;
  whether `api.md` keeps its own shapes or cites inputs
  (`Body: NewTodo`), deferred as a second vocabulary change; the ids'
  final spelling; whether the rename of stage 11's problem ids is done
  by regeneration alone.

## Open, carried

Handoffs 11, 12 and 13's open items carry. Added:
- Auth as subsystems (above), to be modelled in its own session before
  its PRD amendment and use cases.
- The precedence rule needs a line in `AGENTS.md` under an rl-0009
  exception, with the index pointer stage 13 added.
- Branded input types as a proof that validation happened (only `valid`
  mints a `NewTodo`), offered in the session as optional; not decided.
