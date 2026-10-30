# Handoff 01: repo initialization, 2026-10-30

The workspace is initialized: three mounts configured with no source,
the PRD written, and the logbook and profile notes started. Next is
slice 1 (Health), the first code. This file and handoff 00 are the
input the next session starts from. Handoff 00's Purpose, How we work,
Sources, Fixed inputs and Testing policy still apply unless this file
changes them.

## What exists

- **Root:**
  - `package.json`: Node 26.13.0 and pnpm 12.5.1 pinned in `engines`,
    `packageManager` and `.node-version`.
  - Scripts `dev`, `check`, `test:unit`, `test:integration`,
    `test:e2e`, plus a `test` guard that exits 1 and names the three
    tiers.
  - `pnpm-workspace.yaml`: catalog with typescript 6.0.3, valibot
    1.5.0, vitest 5.0.5 and wrangler 4.156.0; `allowBuilds` for
    esbuild and workerd only.
- **Mounts under `apps/todo/`:**
  - `contract`: TS source export, valibot.
  - `api`: hono 4.13.14 and `@hono/valibot-validator` 0.6.2;
    `workers_dev` and `preview_urls` off; integration tests through
    `@cloudflare/vitest-plugin`.
  - `web`: Kit 3.1.0 and adapter-cloudflare 8.0.1; `API` service
    binding; Kit 3 flat config in `vite.config.ts`.
- **Governance:** `AGENTS.md` (Commands and Rules match the reference),
  `.rsb/governance.lock`, `.github/workflows/scorecard.yml`.
- **Spec:** `prd/todo.md`. It has the upstream TodoMVC functionality
  verbatim, constraints C-fixed, C-catalogue and C-secure, 14
  deviations, the API, the envelope, Security, 8 slices and 38
  scenarios.
- **Logbook:** `README.md` (layout and entry formats),
  `profile-notes.md` (P1–P25), `drafts/` (the init and PRD drafts, as
  reviewed), `findings/` (empty).

Checks at commit: `pnpm install --frozen-lockfile`, `pnpm check` and
the three tiers exit 0, and `pnpm test` exits 1 as designed. The tiers
pass on empty (P10), and web `test:e2e` is an `echo` placeholder
(P24).

## Changes from handoff 00

- **valibot, not zod** (owner, at init review). Handoff 00 recorded
  "zod v4 in contract" as a standing detail; the profile's validation
  library is valibot (P25). zod stays in the lockfile only as a
  dependency of `@cloudflare/vitest-plugin`.
- **Drafts live in `logbook/drafts/`**, not the repo root (owner).
- **Slice 1 decisions are Claude's** (owner). Claude settles C1–C5 and
  builds on them. The owner reviews the result, then the two discuss
  each decision in turn. The decisions and their reasons are in
  `logbook/drafts/2026-10-30-02-slice-1-decisions.md`, written before
  any slice 1 code so the review can compare the code against them.
- **Write-time changes** are in init draft §8: Kit and adapter one
  release back (release-age gate, P20), `allowBuilds` (P21), Kit 3
  config (P22), `app.html` at init, the e2e placeholder (P24), and
  telemetry (P23).

## Agreed at init (S1–S5)

- **S1 API surface** and **S3 limits:** as in `prd/todo.md` (API, Security).
- **S2 filtering:** both patterns, as deliberate variants (P15).
- **S4 request paths:** form actions only this iteration.
- **S5 scenarios:** several per slice, each citing its upstream
  sentence. "API down" for health is a web unit test, not e2e.

## Open

- **P19 request-path catalogue (later iteration).** One example each
  of the ways a page reaches the API:
  - remote functions (`query`, `command`, `form`)
  - a `+server.ts` endpoint called by client `fetch`
  - a load-only read
  - a streamed load

  This iteration uses form actions only (PRD deviation 12).
- **P23 wrangler telemetry.** `send_metrics: false` in `wrangler.jsonc`
  does not stop calls to `sparrow.cloudflare.com`; only
  `WRANGLER_SEND_METRICS=false` does, and nothing in the repo sets it.
  Slice 1 records how `dev` and e2e behave with it unset.
- **P12 debt baseline.** No format is decided, so no file exists.

## Environment

Unchanged from handoff 00, plus:
- **pnpm:** use `~/.local/share/pnpm/bin/pnpm`. In the sandbox its store
  is `node_modules/.pnpm-store`, which is ignored.
- **Release-age gate:** pnpm 12 gates fresh releases and writes
  `minimumReleaseAgeExclude` into `pnpm-workspace.yaml` by itself. Delete
  that key and pin an older release instead (P20).
- **Untracked dotfiles:** the sandbox creates placeholder files (such
  as `.bashrc`, `.idea`, `.mcp.json`, `.vscode`) that show as
  untracked. Stage by explicit path; never commit or ignore them.

## Next step: slice 1, Health

Start from `logbook/drafts/2026-10-30-02-slice-1-decisions.md`, then
the usual loop: draft, write, checks, owner review (including each of
C1–C5 in turn), logbook entries, local commit, handoff 02.

Done when:
- `GET /health` returns `200 { ok: true }` in the envelope.
- The BFF `/health` page shows the API as up, and as down when a fake
  binding fails (unit).
- An unknown route returns 404 `not_found`, a body over 8 KiB returns
  413 `too_large`, and `internal` never carries the cause.
- PRD scenario 1.1 passes in Playwright, and the e2e placeholder is
  gone.
- `pnpm dev` runs both Workers, and the web reaches the API through
  the binding.
- `passWithNoTests` is removed from every config whose folder now has
  tests.
- `logbook/findings/01-health.md` is written, and profile notes are
  updated (P5 scan, P10, P24).
