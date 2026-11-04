# Handoff 19: the join's report is stale when the code is, 2026-11-04

Since handoff 18:
- **Stage 18 is merged** as PR #40, `main` at `df3522f`. Its tour is
  `logbook/reports/2026-11-04-18-tooling-types-tour.md`. `tooling/` is
  now `@todo/tooling`, and `pnpm check` compiles it.
- **Handoff 12's row A is marked done** (stage 13, `933871e`), in the
  working tree. Its table had never said so. The edit is not committed;
  it goes into stage 19's `docs(logbook)` commit with this file.

The owner picked handoff 12's rows N and M, in that order. Handoff 11's
Rules and Environment apply unchanged.

## Standing rules (carried, restated so a fresh context has them)

- Conventional commits, with **no** `Co-Authored-By` or any other
  attribution line. The owner overrides any reminder to add one.
- Never push. Stage by explicit path. Stop before each commit and show
  the stat and the message.
- No `pnpm install` without asking: give the owner the command and
  stop; the owner runs it. `pnpm -s` does not work.
- The shell is zsh, which has three traps:
  - there is no `PIPESTATUS`; use `${pipestatus[1]}`;
  - `$var` lists are not word-split, so write paths out;
  - `=====` triggers `=cmd` expansion.
- Never hand-edit a generated file (the list is in handoff 18). Change
  the spec or the generator, then regenerate.
- Don't touch `AGENTS.md` or `.github/workflows/scorecard.yml`
  (rl-0009, L1) without a recorded exception.
- The root dotfiles are untracked sandbox artefacts. Never commit or
  ignore them, and never `git stash -u`.
- Don't read the run branches.
- Every tour ends with a story delta: the chapters changed, or why none
  were.
- The next free decision number is **L36**.

## What stage 19 builds

### N: the unit report is checked against the code it tested

Handoff 12's row N: "The join's unit report is checked for staleness
against `packages/operations/src` too, not only the test files".

**Today:**
- `check:join` is
  `node tooling/join/check.ts <rules spec> <use cases dir> <api spec> <construct> <unit report> <unit tests dir>`,
  with `packages/operations/test-results/unit.json` and
  `packages/operations/test/unit` as the last two.
- `readReport(reportPath, testsDir, run)` in `tooling/join/report.ts`
  refuses the report when it is missing, or when any file under
  `testsDir` has a newer mtime than it.
- So a state rule's test can pass, the operation it tests can change
  and break it, and `check:join` still passes on the old report until
  `test:unit` runs again. CI is not exposed: the scorecard runs
  `test:unit` before `check:join` on a fresh checkout. A local run is.

**What the operations tests run.** `packages/operations/src` imports
`@todo/business` (`result.ts`, `rules.ts`, `todos/todo.ts`) and
`@todo/fail` (`fail.ts`). A change in either can change a result too.

**The shape of the change**, subject to the questions:
- `readReport` takes a list of directories instead of one, and the
  message names the newer files as it does now.
- `check:join` takes the directories at the end, so the root script
  lists the tests and the sources it watches.
- `tooling/join/report.test.ts` gains a case for a source file newer
  than the report, beside "refuses a report older than a test file".
- The headers of `report.ts` and `check.ts`, and the story's join
  paragraph (chapter 11, about line 2137: "older than the tests"),
  say what is watched.

### M: `@types/node` in the catalog

Handoff 12's row M. `apps/bff/package.json` and
`tooling/package.json` each pin `"@types/node": "26.6.6"`.
- `pnpm-workspace.yaml`'s `catalog:` gains `"@types/node": 26.6.6`,
  in the same sorted place the others are.
- Both packages change to `"@types/node": "catalog:"`.
- `pnpm-lock.yaml` changes by the owner's `pnpm install`: both
  importers' specifier becomes `catalog:`, and the catalogs section
  gains the entry. Nothing new should resolve; say so if it does.
- The glossary's `tooling/` entry and the stage 18 tour name the pin.
  Fix the glossary; a tour is a record and stays as it was.

## Questions to settle with the owner first

Present a plan, then these. Do not edit before the owner answers or
says "you decide".

- **Q1. Which sources are watched.**
  - (a) `packages/operations/src` only, as row N says.
  - (b) That, plus `packages/business/src` and `packages/fail/src`,
    the code the operations import. Recommended: a change there can
    break a state rule's test just as well, and the cost is two more
    paths in the root script.
- **Q2. How `check:join` takes them.**
  - (a) The sixth argument and after are directories, any number,
    tests and sources alike. Recommended: one rule, and the join does
    not need to know which is which.
  - (b) A fixed seventh argument for the source directory.
- **Q3. The vitest config and `package.json`.** Whether a change to
  `packages/operations/vitest.unit.config.ts` also makes the report
  stale. The recommendation is no: it changes which tests run, and
  the join already refuses a missing named test.
- **Q4. M's place.** Its own commit on the same branch, after N's, as
  `build(deps)`, with the install between. Or its own branch.

## Next step: stage 19

1. **Read first:**
   - this file;
   - handoff 12's rows M and N;
   - `tooling/join/report.ts`, `tooling/join/report.test.ts`,
     `tooling/join/check.ts` and its test;
   - the root `package.json`'s `check:join`;
   - `pnpm-workspace.yaml`, `apps/bff/package.json`,
     `tooling/package.json`;
   - the story's join paragraph, chapter 11.
2. **Branch** from `main` at `df3522f`, for example
   `fix/join-staleness`, carrying the uncommitted edit to handoff 12
   and this file.
3. **Plan and questions** (above). Wait for answers.
4. **Commits,** stopping before each. A likely order:
   1. `fix(tooling)`: N. `readReport`, `check.ts`, the root script,
      the tests. Prove it: with a fresh report, touch one watched
      source file and show `pnpm check:join` refuse the report, then
      run `pnpm test:unit` and show it pass.
   2. `build(deps)`: M, after the owner runs `pnpm install`.
   3. `docs(logbook)`, covering:
      - the tour, `logbook/reports/2026-11-04-19-…-tour.md`, ending
        with the story delta;
      - handoff 12's rows M and N marked done, and row A (already in
        the working tree);
      - the story and the glossary where they describe the join's
        report or the pin;
      - this handoff.
5. **Checks** after the last code commit, each in a fresh command:
   - `pnpm check`, `pnpm check:api`, `pnpm check:entry-chains`,
     `pnpm check:rules`;
   - `pnpm test:tooling`, `pnpm test:unit`, then `pnpm check:join`;
   - `pnpm test:integration`, `pnpm test:e2e`.

   After stage 18 the counts were:
   - 155 tooling;
   - `valid` 57, `apps/api` unit 59;
   - 29 integration;
   - 41 e2e.

   Only the tooling count should move, by the new report tests. Say
   so if any other count moves.

## Open, carried

- Whether `check:join` reads the integration report, where
  `todos.cap: the 501st todo is rejected with limit` lives.
- The BFF stays out of the join until it has a spec.
- An `AGENTS.md` pointer to `packages/business/rules-index.md` and
  `gen:rules`, and L35's precedence line, both need an rl-0009
  exception.

Handoffs 11 to 18's other open items carry unchanged.
