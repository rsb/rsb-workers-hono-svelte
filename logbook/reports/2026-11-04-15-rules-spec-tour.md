# Review tour: stage 15 (the rules spec and its generator), 2026-11-04

Claude wrote this tour of stage 15 for the owner to review against the
code. It was written, not led live. Stage 15 builds L34: a rules spec,
`prd/todo/rules.md`, from which the rule table, `valid`'s problems,
rule functions and validators, and a rules index are generated, with
`--check`. Stage 11's four validators were regenerated with their 53
tests unchanged, as the proof.

The branch is `feat/rules-spec`, made from `main` at `faf39cf` (PR #35
merged). It has four commits:
- `f8ce813` `docs(prd)`: `rules.md`, and the use cases citing ids
  alone.
- `105b5e1` `refactor(valid)`: the problems renamed to rule and
  violation, by hand.
- `32c4587` `feat(tooling)`: the generator, its outputs, the moved
  constants and `gen:rules` / `check:rules`.
- the fourth `docs(logbook)` commit: the story, the glossary, the
  profile notes and this tour.

Checks after the third commit, each in a fresh command:
- `pnpm check` exits 0.
- `pnpm check:api` exits 0.
- `pnpm check:entry-chains` exits 0.
- `pnpm check:rules` exits 0.
- `pnpm test:tooling`: 123 pass.
- `pnpm test:unit`: every package passes; `valid` 53 of 53.
- `pnpm test:integration`: 29 pass.
- `pnpm test:e2e`: 41 pass.

"Why" cites handoff 14's questions and the owner's decisions on the
first review of `rules.md`:

| Question | Owner's answer |
|---|---|
| Where a rule's words live | In the spec, mirrored in `RULES`; the message tables stay hand-written |
| Whether `api.md` keeps its own shapes | Deferred |
| The ids' final spelling | The six the use cases cite, with `todo.id` renamed `todos.unique_id` |
| Whether the rename is done by regeneration alone | No: by hand first, then the generator with the tests unchanged |
| `Applies:`, the validator's `rules`, the route's validator, the join | Stage 16 |
| The index's location | `packages/business/rules-index.md` |
| `setAllCompleted` taking `{ completed }` | A later change |

## 1. The rules spec

`prd/todo/rules.md`, commit `f8ce813`.

- **What:**
  - The preamble scopes the file to business rules and names its three
    outputs.
  - "Every input" says how decode, apply and build run (L27).
  - "How an input is written" and "How a rule is written" are the
    vocabulary the generator reads.
  - Then the constants, the four inputs and the six rules.
- **Why:** L29, L31, L34, and the owner's decisions on the first
  review:
  - **Business rules only.** Wire rules (`BODY_LIMIT_BYTES`, a closed
    object, a query given once) stay in `api.md` with no id.
  - **Decode problems keep `{ field, rule: "not_text" | "not_boolean" }`**
    and are not cited.
  - **`Form: custom` is in the vocabulary now**, though no rule uses it.
    The generator's fixture test has one.
  - **`todos.order`'s source is DB6, story chapter 8**: every select
    orders by `seq`. It is a guarantee over every list the store
    returns, not a line of `GET /todos`.
  - **`todo.exists` keeps the PRD's API table as its source**,
    "`PATCH /todos/:id` and `DELETE /todos/:id` (404)". It is a PRD
    line, not the wire. `prd/todo.md`'s API table is product text: it
    says what the product promises when a todo is missing.
    `prd/todo/api.md` is the wire spec, which says how that promise is
    carried. A rule's source is where the demand comes from (L31), so
    it cites the product.
  - **`todo.id` renamed `todos.unique_id`.** The id reads like the
    field; the new one says what the store promises, and its subject is
    the list, since uniqueness is across todos. Its source is story
    chapter 8's guarantees (L29), with the id a UUID from the id
    source (D13).
- **The use cases:** the Assumes, Given and Guarantees lines carry the
  id alone, with no gloss. The rules index supplies the words.
  - `change-a-todo` reads "Assumes `patch.nonempty`, `title.length`."
    "When a title is given" now lives in `rules.md`, where `title` is
    marked `optional`.
  - `mark-all-completed`'s input reads "A `Completed`".
  - `count-todos` cites no ids and is unchanged.
  - **A correction:** I said three use cases cited `todo.id`. Only
    `add-a-todo` did.
- **Changed without being asked:** the id rule was wrong. "How a rule
  is written" said the subject is `todo` or `todos`, which
  `title.length` and `patch.nonempty` break. The generator found it.
  It now says the subject is what the rule is about: a field, an input,
  `todo` or `todos`. The fix is in commit 3, beside the check that
  found it.

## 2. The rename, by hand

Commit `105b5e1`.

- **What:**
  - `title.empty` and `title.too_long` become
    `{ field, rule: "title.length", violation: "empty" | "too_long", max }`.
  - `patch.empty` becomes `{ rule: "patch.nonempty", violation: "empty" }`.
  - Decode problems are unchanged.
  - The api's message table words `title.length` by its violation.
  - The BFF's table words both violations with one case.
  - `edit-todo.ts` treats `title.length` with `empty` as "leave the
    todo as it is" (deviation 19).
- **Why:** the 53 tests assert exact problem literals. The rename and
  "regenerate with the tests unchanged" cannot be one commit. Done by
  hand first, the generator commit can show no diff under
  `packages/valid/test`.
- **What changed in the tests:** nine expected literals and one test
  name in `valid`, plus the same literals and their `it.each` labels in
  the two message tests. I had said ten literals; it is nine plus the
  name. No words changed.

## 3. The generator

`tooling/rules/`, commit `32c4587`.

- **What:**
  - **`parse.ts`** reads `rules.md` and checks it against its own
    vocabulary. It fails on:
    - an id that is not `<subject>.<property>`, a missing `Kind:`, or
      a missing `Source:` (L31);
    - a violation whose condition is not its form's;
    - a form or violations on a state rule or a guarantee;
    - a parameter that names no constant;
    - a field rule or an input rule that is not defined, or an input
      rule no input applies;
    - an `at least` rule counting a field the input lacks as optional.
  - **`use-cases.ts`** lints the use cases' citations. Every id exists
    and is cited in the section for its kind (Assumes input, Given
    state, Guarantees guarantee). A Given or Guarantees item is the id
    alone, which enforces the no-gloss decision. An input rule appears
    only in an Assumes clause, and a Refused id is also under Given.
  - **`emit.ts`** writes:
    - `packages/business/src/rules.ts`: `TITLE_MAX`, `TODO_LIMIT`,
      `RuleKind`, `RuleId`, `Rule` and `RULES`;
    - `packages/valid/src/problem.ts`;
    - `packages/valid/src/rules/title-length.ts` and
      `patch-nonempty.ts`;
    - the four validators;
    - `packages/business/rules-index.md`.
  - **`generate.ts`** is the command line, run as `pnpm gen:rules` and
    `pnpm check:rules`.
    - Both fail when a custom rule's file is missing or does not
      export `id`, and when `valid/src/rules` holds a file no rule
      owns.
    - `--check` writes nothing and compares every output byte for
      byte.
  - **28 `node --test` tests:** parse, the use-case lint, `--check` on
    the committed files and on stale copies, and a fixture with a
    custom rule. The fixture shows the custom rule is imported, applied
    after the generated one, and its file left alone.
- **Hand-written:**
  - `fields/decode.ts`, unchanged;
  - the new `fields/problems.ts`, whose `problemsFrom` gathers every
    field's problem in field order. It lets each validator narrow every
    field to success without a cast.
- **Deleted:** `fields/title.ts`.
- **Moved:** `TITLE_MAX` and `TODO_LIMIT` left `todos/todo.ts`.
  `rules.ts` is their only home; `add-todo.ts` and its test import
  `TODO_LIMIT` from there.
- **The proof:** `git diff -- packages/valid/test` is empty for this
  commit, and `valid`'s 53 tests pass against the generated validators.
- **Changed without being asked:**
  - **`valid`'s package description** said "decode, check, build". It
    now says "decode, apply, build, generated from prd/todo/rules.md"
    (L27's rename in stage 14).
  - **`entry-chains/read.test.ts`** used the deleted `fields/title.ts`
    as its example of a path the exports map does not list. It now uses
    `fields/decode.ts`, which is still unexported.
  - **A one-off strict `tsc` over `tooling/rules`** passed, with the
    base config and `@types/node`. Nothing type-checks `tooling/`
    normally; the tests run it under Node's type stripping.
- **Not done, for the owner:**
  - **`check:rules` is not a step of the required check.**
    `scorecard.yml` is an owned governance file (L1, rl-0009).
    `test:tooling`, which CI already runs, runs `--check` on the
    committed files through `generate.test.ts`, so drift fails CI
    either way. A separate step needs a recorded exception.
  - **`AGENTS.md` does not point at the rules index** or at
    `gen:rules`, for the same reason.

## 4. Noted for the review

- **`api.md`'s "at least 1 field" on `PATCH /todos/:id` stays.** It is
  the HTTP redundancy decided in stage 11 Q2: the contract refuses an
  empty patch on the wire, and `valid` refuses it again for every
  delivery. It is not drift, and `rules.md` does not cite it.
- **The build order in chapter 7 was wrong, and the code won (L35).**
  The story said decode, then apply, then build, with the patch rule in
  build. The code applies the rule on the whole input first, before any
  field is decoded, and alone when it fails. Chapter 7 and the
  glossary's Apply and Build entries now say so.
- **Records kept as written:**
  - The decision list's L27 still names `title.empty` as an example
    and says the ids are fixed. L33 refines it, and it records the
    decision as made.
  - P50 keeps "the enforcers", as stage 14's tour decided.
  - Merged handoffs and tours keep the old ids.

## 5. Story delta

Chapters changed:
- **The opening:** L33 says stage 15 did the rename and the use-case
  lint, and that the rest is Target until stage 16. L34 says it is
  built: `tooling/rules`, `gen:rules`, `check:rules`.
- **5, Entry points:** the boundary table's `valid` and delivery rows
  carry the rule and violation (`title.length`, `empty`).
- **6, Operations:**
  - The L31 bullet replaces its **Target.** with what `check:rules`
    fails on, and what it does not check.
  - `todo.id` is now `todos.unique_id`.
- **7, Business:**
  - `todo.id` is now `todos.unique_id`.
  - The `valid` section says the validators, `problem.ts` and `rules/`
    are generated. Decode, apply and build are each placed in their
    file. Apply puts the rule on the whole input first, and build only
    assembles (the code won).
  - The problem paragraph carries `violation` and the new ids. The
    rename's **Target (L33).** paragraph is replaced by what was done.
  - The rule table leaves **Target.** for a paragraph of its own, with
    the index.
- **8, Data:** `todo.id` is now `todos.unique_id`.
- **11, Contracts:**
  - "What makes a spec" says the rules spec's check exists.
  - Generation now stops at the validators and the rule table; the
    **Target (L34).** paragraph is now present tense.
- **13, Failures:** the message tables' examples use `title.length` and
  `patch.nonempty`.
- **Glossary:**
  - Rule and Rule id are locked with L34 and the new ids. The rename
    left target.
  - Violation is locked.
  - Apply's code is `valid/src/rules/`, generated, and the patch rule
    comes first.
  - Build only assembles.
  - Problem's example carries the violation.
  - Use case and Spec level say what `check:rules` checks.
  - Guarantee and Rule id say `todos.unique_id`.
- **Profile notes:**
  - P52's ids and files.
  - The checks of P60–P63.
  - New: P64, the rules spec and its generator.

Not changed: chapters 0–4, 9, 10 and 12. None of them names a problem
id, the rule table or the generator.
