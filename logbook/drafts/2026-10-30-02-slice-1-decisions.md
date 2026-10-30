# Slice 1 (Health): decisions settled by Claude

Working agreement for this slice (owner, 2026-10-30): Claude settles
the open slice 1 composition questions from handoff 00 (C1–C5) and
builds on them. The owner reviews the result, then the two discuss
each decision in turn. A decision changed at that review is recorded
here, with what it changed in the code.

Each entry: the decision, the reason, and what it constrains in the
code, so the review can check one against the other.

## C1 Import graph

**Decision.** api → contract, web → contract, contract → nothing in the
workspace (valibot only). web never imports api. Inside api the
direction is `routes → handlers → operations → data port`, and only
`src/index.ts` imports an adapter.

**Reason.** It is the only graph where contract is the single shared
truth (P17: limits defined once), and each arrow is checkable by an
import scan, which is what the profile needs.

**Constrains.** No `@todo/api` in `web/package.json`. No relative
import that climbs out of a mount. In slice 1 the data port does not
exist yet (C2), so the api chain stops at operations.

## C2 Health and the store

**Decision.** Health stays pure: `GET /health` returns `200 { ok: true }`
without touching the store port.

**Reason.** The store arrives in slice 2. Pinging it would add a kind
`unavailable` (503) that the PRD does not have, and an in-memory store
inside the same Worker cannot be down independently of the Worker,
so the ping would prove nothing.

**Constrains.** The envelope kinds stay the five in the PRD. Revisit if
the store ever becomes an external binding (KV, D1, DO).

## C3 Handler placement

**Decision.** `routes/` binds paths and validators. `handlers/` is the
HTTP face: one named export per file, which turns a validated input
into an envelope response. `operations/` is the pure core: no Hono and
no `Context`, and it returns `Result`.

**Reason.** Operations can then be unit-tested in node with no Workers
pool (P9), and "one route, one handler file" can be checked by machine.

**Constrains.** In slice 1 health has a handler but no operation (there
is nothing to compute). The first operation arrives in slice 2. The
error handler and not-found handler are handlers too, and each is
exported so the unit tier can call it directly (handoff 00 correction).

## C4 `Result<T, E>`

**Decision.** Hand-rolled and private to the api, in
`api/src/result.ts`. It is not in contract and is not a dependency.

**Reason.** Only the api uses it. The web sees envelopes, not
`Result`, so putting it in contract would widen the shared surface for
no consumer. Hand-rolled keeps it a dozen lines with no supply-chain
cost.

**Constrains.** Contract exports schemas, types and limits only. The
handler is the single place `Result` becomes an envelope.

## C5 Web test tiers

**Decision.** Web has unit and e2e tests but no integration tier. The
slice covers all three tiers across the packages: api has unit and
integration, web has unit and e2e.

**Reason.** The web's only integration point is the `API` binding.
Unit tests cover it with a fake binding, including the failure case,
and e2e covers it with the real one. A web integration tier would
repeat one or the other.

**Constrains.** Web has no `vitest.integration.config.ts` and no
`test:integration` script; the root's `--if-present` skips it. The
"API down" case is a web unit test (PRD slice 1 note).

## Details settled at the same time

- **Validation:** valibot schemas in contract, `@hono/valibot-validator`
  in api routes (owner choice, P25).
- **Unknown route:** tested at integration, not as a unit test of the
  app (handoff 00 correction).
- **Body limit:** Hono `bodyLimit` at 8 KiB is registered app-wide in
  slice 1, before any route that has a body, so `too_large` is tested
  from the start (deviation 8).
- **Telemetry (P23):** `dev` and e2e will trip wrangler telemetry. Slice
  1 records whether the run fails or only logs, and does not set the
  env var silently.
