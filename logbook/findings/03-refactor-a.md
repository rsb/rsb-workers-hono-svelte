# Findings: refactor A, the move

Findings from refactor A, carried from section 7 of the
[report](../reports/2026-10-31-05-refactor-a-move.md). Format:
[README](../README.md). Paths are from the repository root. "@ refactor
A" means `a6676cd`. Numbers continue from
[02-add-and-list.md](02-add-and-list.md).

## F28 Worker names keep the `todo-` prefix

- **Seen:** `apps/api/wrangler.jsonc`, `apps/bff/wrangler.jsonc` @
  refactor A
- **Part:** 1a (layout)
- **Finding:**
  - The api Worker stays `todo-api`. The PRD names it, and the BFF's
    service binding and the `https://todo-api/...` URLs use it.
  - The BFF Worker changed from `todo-web` to `todo-bff`, to match its
    directory.
  - Worker names share the Cloudflare account's namespace, so they keep
    the `todo-` prefix. The "no product namespace" rule (A9) applies
    inside the repo, not to the account.
  - The npm scope `@todo/` is unchanged.
- **Outcome:** kept. Worth recording for the profile.

## F29 The new packages have no governance mount

- **Seen:** `.rsb/governance.lock` @ refactor A
- **Part:** 1a (governance)
- **Finding:**
  - The mounts were updated to `apps/api`, `apps/bff` and
    `packages/contract/api`, with the owner's approval.
  - The lock hashes only `AGENTS.md`, so rl-0009 was not involved.
  - `packages/business`, `packages/operations` and
    `packages/data/memory` have no profile mount. The profile has to
    decide what governs them.
- **Outcome:** open

## F30 The PRD described the old layout

- **Seen:** `prd/todo.md:196` (Shape) @ refactor A
- **Part:** 1a (layout)
- **Finding:** Shape said "`apps/todo/` holds `api` … `web`". The PRD is
  a fixed input, so refactor A did not edit it. The stage 06 amendment
  replaced Shape with the A1 layout.
- **Outcome:** changed (`d37c4ff`)

## F31 A leftover `apps/todo/` directory

- **Seen:** `apps/todo/.claude/.cc-writes` @ refactor A
- **Part:** 1a (layout)
- **Finding:** after the move, `apps/todo/` holds only an ignored
  `.claude/` directory. Git does not see it.
- **Outcome:** open, for the owner to delete

## F32 The e2e count is 9, not 8

- **Seen:** `test:e2e` on `main` `89bdf8b` and after the move
- **Part:** test
- **Finding:** the slice 2 findings say "8 of 8" e2e. The baseline ran
  9: the eight add-and-list scenarios (2.1–2.8) plus the health test.
  Most likely the 8 counted only the slice 2 scenarios.
- **Outcome:** kept (note)

## F33 Two export patterns

- **Seen:** `packages/{business,operations,data/memory}/package.json`,
  `packages/contract/api/package.json` @ refactor A
- **Part:** 1a (layout)
- **Finding:**
  - The new packages export `"./*": "./src/*"`. An import names the
    exact file it reaches, without a barrel file.
  - The contract keeps its single `"."` export, because it is a
    published surface, not a set of internals.
  - The profile should choose one of these patterns, or both on
    purpose.
- **Outcome:** open
