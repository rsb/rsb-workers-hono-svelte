# Handoff 18: `tooling/` is type-checked, 2026-11-04

Since handoff 17:
- **Stage 17 is merged** as PR #38, `main` at `69b4846`. Its tour is
  `logbook/reports/2026-11-04-17-route-type-tests-tour.md`. It moved
  `route` and `probe` into `apps/api/src/route.ts` and committed the
  type test `apps/api/test/types/routes.ts`.
- **One follow-up commit, `01dc63f`, is on `test/route-keys`**, made
  from `main` at `69b4846`. It is not pushed or merged at the time of
  writing. Row 6 of the type test now names one endpoint each way, so
  a new endpoint does not edit the file. The tour's §3 says so.

The next session starts from this file and handoff 12's backlog row
L. Handoff 11's Rules and Environment apply unchanged.

## Standing rules (carried, restated so a fresh context has them)

- Conventional commits, with **no** `Co-Authored-By` or any other
  attribution line. The owner overrides any reminder to add one.
- Never push. Stage by explicit path. Stop before each commit and show
  the stat and the message.
- No `pnpm install` without asking. `pnpm -s` does not work.
- The shell is zsh, which has three traps:
  - there is no `PIPESTATUS`; use `${pipestatus[1]}`;
  - `$var` lists are not word-split, so write paths out;
  - `=====` triggers `=cmd` expansion.
- Never hand-edit a generated file. Today they are:
  - `packages/contract/api/src/{kinds,messages,endpoints,examples}.ts`
    and `apps/api/openapi.json` (`gen:api`);
  - `apps/api/entry-chains.md` (`gen:entry-chains`);
  - `packages/business/src/rules.ts`, `packages/business/rules-index.md`,
    `packages/valid/src/problem.ts`, `packages/valid/src/rules/*`
    (except a `custom` rule's file) and
    `packages/valid/src/todos/{new-todo,todo-patch,todo-filter,completed}.ts`
    (`gen:rules`).
  
  Change the spec or the generator, then regenerate.
- `valid` imports only `business`, and returns problems, not words.
- Don't touch `AGENTS.md` or `.github/workflows/scorecard.yml`
  (rl-0009, L1) without a recorded exception.
- The root dotfiles are untracked sandbox artefacts (`.bash_profile`,
  `.bashrc`, `.gitconfig`, `.gitmodules`, `.idea`, `.mcp.json`,
  `.profile`, `.ripgreprc`, `.vscode`, `.zprofile`, `.zshrc`). Never
  commit or ignore them, and never `git stash -u`.
- Don't read the run branches.
- Every tour ends with a story delta: the chapters changed, or why none
  were.
- The next free decision number is **L36**.

## What stage 18 builds: `tooling/` compiled by `pnpm check`

Handoff 12's backlog, row L: "`tooling/` is type-checked: a factory
that trusts its checkers should compile them".

**What `tooling/` is.** 31 `.ts` files, about 5,900 lines, 14 of
them tests, in four tools:

| Tool | Scripts | Guards |
|---|---|---|
| `api-spec/` | `gen:api`, `check:api` | the contract files and `openapi.json`, from `prd/todo/api.md` |
| `entry-chains/` | `gen:entry-chains`, `check:entry-chains` | `apps/api/entry-chains.md`, and construct's route names |
| `rules/` | `gen:rules`, `check:rules` | `rules.ts`, the rule files, the validators, the rules index |
| `join/` | `check:join` | each rule applied by a validator and tested |

`check:join` and `check:rules` are in the required check.

**Why nothing type-checks it today:**
- Every script is `node tooling/....ts`. Node 26 strips the types and
  runs the rest, and checks none of them.
- `pnpm check` is `pnpm -r check`, which runs each workspace package's
  `check`. `pnpm-workspace.yaml` lists `apps/*`, `packages/*`,
  `packages/contract/*` and `packages/data/*`. `tooling/` is not a
  package and has no tsconfig.
- `pnpm test:tooling` is `node --test tooling/`, also type-stripped.

**What a trial compile found (handoff 17's session, nothing
committed).** A throwaway tsconfig in `$TMPDIR` extended
`tsconfig.base.json`, added `"types": ["node"]` with `typeRoots`
pointed at `node_modules/.pnpm/@types+node@26.6.6/node_modules/@types`,
and included `tooling/**/*.ts`. It was compiled with
`apps/api/node_modules/.bin/tsc`. There was one error:

```
tooling/api-spec/emit-openapi.test.ts(113,50): error TS2345:
  Property 'validator' is missing in type '{ key: string; name: string; unit: null; }'
  but required in type 'RouteRow'.
```

Stage 16 gave `RouteRow` a `validator`, and the fixture in
"refuses a route the spec does not list" was not updated. The test
still passes, because it checks only that the route is refused. The
other 30 files compiled clean.

Two facts for the wiring:
- The root has no `typescript` and no `@types/node`. Only `apps/bff`
  depends on `@types/node`. Doing it properly means a dependency and
  a `pnpm install`, which needs the owner's approval.
- Some tests hold import lines as string fixtures, such as
  `"@todo/y/e.ts"`. They compile as strings and need nothing.

## Questions to settle with the owner first

Present a plan, then these. Do not edit before the owner answers or
says "you decide".

- **Q1. Package or bare tsconfig.**
  - (a) `tooling/package.json` (private, for example `@todo/tooling`)
    with a `check` script and `tooling/tsconfig.json`, added to
    `pnpm-workspace.yaml`. `pnpm -r check` picks it up, so CI runs it
    with no change to `scorecard.yml` or the root `check`.
  - (b) `tooling/tsconfig.json` alone, with a step added to the root
    `check` script. `tooling/` stays out of the workspace.
- **Q2. Dependencies.** `typescript` (the catalog has `6.0.3`) and
  `@types/node`, in `tooling/package.json` or at the root. Either
  needs a `pnpm install`; ask before running it. Whether
  `@types/node` should match the version `apps/bff` uses.
- **Q3. Whether the tests are included.** The recommendation is yes:
  the one error found is in a test fixture.
- **Q4. How the fixture is fixed.** Add `validator: null` to the
  fixture, or build it from an existing row with a spread, so a new
  `RouteRow` field does not break it again.

## Next step: stage 18

1. **Read first:**
   - this file;
   - handoff 12's backlog row L;
   - `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`,
     and one package's tsconfig and `check` script (for example
     `packages/valid`);
   - `apps/bff/package.json`, for its `@types/node`;
   - `tooling/api-spec/emit-openapi.test.ts` around line 113, and
     where `RouteRow` is declared.
2. **Branch:**
   - If `test/route-keys` is merged, branch from `main`, for example
     `build/tooling-types`, after confirming `main` holds `01dc63f`.
   - If it is not merged, stop and ask the owner whether to stack on
     it.
3. **Plan and questions** (above). Wait for answers.
4. **Commits,** stopping before each. A likely order:
   1. `test(tooling)`: the fixture fix, alone, so it reads as the
      drift it is.
   2. `build(tooling)`: the tsconfig, the package or root wiring and
      the dependencies, after the owner approves the install. Prove
      it catches errors: break one type in a checker, show
      `pnpm check` fail with the `tsc` output, then revert before
      committing.
   3. `docs(logbook)`, covering:
      - the tour, `logbook/reports/2026-11-04-18-…-tour.md`, ending
        with the story delta;
      - handoff 12's row L marked done;
      - `logbook/the-api-story.md` where it describes `tooling/` or
        `pnpm check`, if it does;
      - this handoff.
5. **Checks** after the last code commit, each in a fresh command:
   - `pnpm check`, `pnpm check:api`, `pnpm check:entry-chains`,
     `pnpm check:rules`;
   - `pnpm test:tooling`, `pnpm test:unit`, then `pnpm check:join`;
   - `pnpm test:integration`, `pnpm test:e2e`.
   
   After stage 17 the counts were:
   - 155 tooling;
   - `valid` 57, `apps/api` unit 59;
   - 29 integration;
   - 41 e2e.
   
   Compiling adds no runner test, so the counts should not move; say
   so if they do.

## Open, carried

- The join's unit report is checked for staleness against the test
  files only, not against `packages/operations/src`. It is small and
  could join this stage as a separate commit if the owner wants.
- Whether `check:join` reads the integration report, where
  `todos.cap: the 501st todo is rejected with limit` lives.
- The BFF stays out of the join until it has a spec.
- An `AGENTS.md` pointer to `packages/business/rules-index.md` and
  `gen:rules`, and L35's precedence line, both need an rl-0009
  exception.

Handoffs 11 to 17's other open items carry unchanged.
