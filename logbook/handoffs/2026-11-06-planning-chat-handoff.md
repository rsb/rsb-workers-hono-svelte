# Planning-chat handoff: the workers-hono-svelte lab, after stage 23

For the next planning session. The repo is the record; this file says
where things stand, what is decided, what is open, and how the owner
works. Read it, then the files it names, before proposing anything.

## Who and what

Rob is a senior staff engineer running a hand-steered lab repo,
`rsb-workers-hono-svelte` (todo app: Hono api Worker + SvelteKit 3.1
BFF Worker, pnpm monorepo, D1, Cloudflare), whose purpose is to
produce "the api story", the reference architecture for the
`workers-hono-svelte` profile in his rsb-workflow software factory.
Complexity is layered onto the demo app deliberately, one feature per
layer it stresses; the end state is a product that could go to market.
A terminal coding agent builds; the planning chat (this role) designs,
writes handoffs, and reviews the agent's plans and commits with
paste-ready answers Rob forwards.

His pillars: Reliability, Security, Performance, Maintainability.
Documented once (`logbook/pillars.md`), measured (`pnpm gen:pillars`
renders `logbook/pillars-view.md`), never tagged, never a build rule.

## How Rob works, and what he pushes back on

- Senior-to-senior, research-backed, precise framing. He corrects
  loose terms (he caught "construct checks the port fits": it is
  TypeScript at the composition root, not a runtime check).
- He is wary of rules and tags on everything. Prefer documenting a
  principle once and reading a measurement over adding a check.
  "Address + check" applies to spec levels that generate or join to
  code; the PRD root, features, concept and decisions get no check.
- Errors as returned values, never thrown across a boundary. One
  authority per decision (an operation). Stores report facts.
- Agent rules (handoff 11, verbatim): conventional commits, no
  attribution lines, Claude never pushes; the owner runs
  `pnpm install` and opens PRs; discuss first, plan and questions
  before code; the agent stops at each commit for the stat and message.
- Review loop that worked for stage 23: the agent posts a plan with
  numbered questions and its recommendation on each; the planning chat
  answers in one paste-ready block, agreeing or overruling with the
  reason; commits that match the plan are waved through on stat and
  message; attention goes to spec commits, the gate/BFF plumbing, and
  the story commit.
- When the agent finds the planning chat was wrong (it did, four
  times: an `input_error` producer, the empty-edit rule, a call count,
  `handleError` in SvelteKit 3), say so plainly and fix it at its layer.

## Where everything is (read in this order)

1. `logbook/handoffs/2026-11-05-23-auth-slice-a.md`: slice A as built
   (L37–L43, the gates, sessions, areas, two databases, access).
2. `logbook/reports/2026-11-05-23-slice-a-review-tour.md`: what the
   agent built, decided and found; ends with the story delta. Note its
   "commit 11 CI regression and its lesson": if it is a lesson for
   every stage, it goes into handoff 24's Rules.
3. `logbook/handoffs/2026-11-05-22-prd-tree.md` and
   `logbook/reports/2026-11-05-22-prd-tree-review-tour.md`: the PRD as
   a tree, features/views/states/boards, data cases (L44–L46).
4. `logbook/the-api-story.md` chapters 14 ("From idea to code") and 15
   (the gates); `logbook/glossary.md` "Gates and identity".
5. `logbook/reports/2026-11-05-22-auth-design.html`: the interactive
   explainer of the whole auth design (also published at
   https://claude.ai/artifact/JKJEme6uBKnqG7U73WpHQY).
6. `logbook/reports/2026-11-05-22-auth-research.md`: the research the
   decisions were tested against, incl. the SvelteKit 3 section
   (Claude Doc: https://claude.ai/artifact/XGKP1jhE51SjjtD6UfYcVD).
7. `prd/_templates/{feature,data-case}.md`, `design/_templates/design-brief.md`,
   `prd/todo/features/*.md`, `prd/todo/access.md`, `prd/todo/data/*.md`.
8. `logbook/handoffs/2026-11-03-12-improvements.md`: the backlog
   (rows A–O; D, E first half, J done; E second half, F, G, H, I, K, O remain).
9. `design/2026-11-03-ui-accounts/` (boards + `source/`), with the
   board maps in each accounts feature.

## State of the code after stage 23 (main is synced)

Two D1 databases (`IDENTITY_DB`: users, sessions; `APP_DB`: todos with
`user_id`), the user id the only key between them. Four gates in
construct order: `requestId`, `bodyLimit`, `channel`, `authenticate`
(unit in `packages/gates`, binding in `apps/api/src/gates/`). Sessions
as hashed rows, idle 24 h and absolute 30 d as business constants,
refresh scheduled by the binding after the response. `access.md`
generated into `business/access.ts`; `run.ts` wraps every operation's
builder; `route()` mirrors the row for 401/403-before-400 ordering.
`GET /sessions/current` returns `{ user?, clearCookie }`. The BFF
forwards Cookie, Origin, Sec-Fetch-Site and Sec-Fetch-Mode over the
binding via `locals.api`, renders the shell from the api's reply,
`handleError` is the one funnel for messages, `+error.svelte` draws a
view. Dev seed: `pnpm seed:dev` (member and admin, tokens in
`apps/api/.dev.tokens`; cookie `sid` in dev, `__Host-sid` in prod).
`readConfig` returns a Result; a bad config answers every request with
our `internal` envelope. Threats table: 3 of 13 rows have a test.
Budgets: `/` = 2 api calls, filters = 3; each api call pays the gate's
one identity round trip.

Wire kinds now include `unauthenticated` (401) and `forbidden` (403,
with reason from a generated list: `channel`, `account_disabled`,
`role`). Both credentials at once is `unauthenticated`.

## Decided, not yet built

- Paid plan; passwords with Argon2id via `@phi-ag/argon2` (module-
  imported wasm), m=19456 t=2 p=1; production caps PBKDF2 at 100k and
  local dev does not enforce it.
- Email sender: Cloudflare Email Service first, Resend second, behind
  a port (slice C).
- Isolation beyond two databases (auth Worker, DO as session write
  authority) deferred; the `sessions` port is the seam.
- Slices: B sign-in/sign-out/sessions page; C sign-up + verification =
  first process + outbox + step record; D roles/admin/disable;
  E second identity method (passkeys or Google).
- The committed `wrangler.jsonc` vars are not a deployable config; a
  tooling test pins that. Option B (local vars in wrangler.jsonc,
  deployed values in `env.production` with the deploy workflow) is the
  shape the deploy stage takes, with CI secrets and Turnstile.

## Open for slice B (handoff 24, not yet written)

Settle these in chat first, then write handoff 24 in the shape of 23
(decisions as L47+, deliverables numbered, questions for the agent's
plan round), commit it to `logbook/handoffs/`, and give Rob the
kickoff line.
1. Input rules for email and password in `rules.md`: email trimmed and
   lower-cased, shape rule, length cap (default 254); password min and
   max length only, no composition rules (defaults 8 to 128); breached
   check carried to first deployment.
2. Sign-in throttle (threats row 8): recommendation is to carry it to
   B's successor with Turnstile, not B.
3. Credential store: one row per user per kind; PHC string with params;
   a `needs_rehash` fact the operation acts on.
4. Sessions page: whether "end all other sessions" requires
   re-authentication in B or waits for C's password-change process.
5. The commit 11 CI regression lesson, into Rules if general.
Also pending: the BFF story needs its revision (locals.api, the frame,
handleError); backlog row O (budgets as a data file the view prints).

## Just before this handoff

Rob changed the feature template's Purpose line from "Two sentences:"
to "A short description: what the user gets done, and what this
feature is not." (`4c2ce3f`). There is no limit on length; the two
questions stay. The six feature files already fit and were not edited.
Who is unchanged: the "The page sits in `accounts.shell` as …" lines
that five features add after their purpose stay where they are, and
whether they belong under Who is not decided.

## Coming later, deliberately not now

View composition: defining a view's data upfront, deciding query and
cache on the api side, and the optimal number of BFF→api calls. It
arrives when a view's call count is what a stage is about; B's views
are one call each.
