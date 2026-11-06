# Data cases: identity

The data spec for the identity database (L42, L46): one entry per store
call, saying what the call promises and costs, never how it is written.
The SQL stays hand-written under `packages/data/d1/src/identity/`. Each
entry's Cost line is the number
`packages/data/d1/test/unit/budgets.test.ts` asserts; a change to one
changes the other in the same commit (L36). Use cases and features
cite an entry as `data/identity.md › <id>`.

Database: `IDENTITY_DB` (the D1 database `todo-identity`)
Tables: `users`, `sessions`
(`packages/data/d1/migrations/identity/0001_users_sessions.sql`). The
`credentials` and `verifications` tables wait for slices B and C.

Every entry:
- Failures: `unavailable` when D1 names a transient or quota error,
  `server` for anything else, our own bugs included
  (`packages/data/d1/src/classify.ts`). The D1 error stays the cause.
- Times are milliseconds since the epoch, as integers; the caller
  passes `now`, so no call reads a clock.
- A user's id is minted once, by the id source, when the user is
  created (D13, L42). It is the only key the app database holds.
- No call takes a scope: an identity row is found by its credential or
  its key, before there is an actor to scope by.

## `sessions.find`
The session a token hash names, with its user's row, or none.

- Port: `SessionLookup.findSession`
- Used by: the `authenticate` gate (L39)
- Input: the SHA-256 hash of the raw token, as hex
- Scope: none
- Result: the session (`id`, `userId`, `channel`, `idleUntil`,
  `expiresAt`, `endedAt`) and its user (`role`, `disabled`,
  `emailVerifiedAt`, `name`, `email`), or `null`. An ended or expired
  session is reported as it is: the gate decides whether it is live.
- Guarantee: one statement, `sessions JOIN users`, on the primary,
  never a replica (L40), so the session and its user describe one
  moment. A user who is disabled is seen as disabled from the next
  request.
- Retry safety: safe; it reads only.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Reads at most 2 rows: the session
  by the `UNIQUE` index on `token_hash`, its user by primary key;
  writes none.
- Rules: none

## `sessions.touch`
Whether a live session's idle window was moved on.

- Port: `SessionTouch.touchSession`
- Used by: the `authenticate` gate's binding, after the response,
  through `ctx.waitUntil`, when the gate says `refreshDue` (L40)
- Input: the session's id, the new `idleUntil`, and `now`
- Scope: none
- Result: `touched | skipped` (`true` or `false`): skipped when the
  session has ended or another touch has already moved it past `now`
  plus half the idle window
- Guarantee: one statement, `UPDATE … WHERE id = ? AND ended_at IS
  NULL AND idle_until < ?`, so two touches that race move it once. The
  new `idleUntil` is never past `expiresAt`: the gate caps it.
- Retry safety: safe; it sets a value and a second call is skipped.
- Failures: `unavailable`, `server`; the binding logs them and the
  request has already been answered
- Cost: 1 round trip, 1 statement. Finds the row by primary key; writes
  at most 1. At most once per session per half idle window.
- Rules: none

## `sessions.start`
A new session row, for a user and a token hash.

- Port: `SessionStart.startSession`
- Used by: the dev seed (`apps/api/scripts/seed-dev.ts`); sign-in from
  slice B
- Input: the session (`id`, `tokenHash`, `userId`, `channel`,
  `createdAt`, `idleUntil`, `expiresAt`)
- Scope: none
- Result: `started | token_taken` (`true` or `false`): taken when a row
  already has that token hash
- Guarantee: one statement. The raw token is never stored, only its
  hash (L40).
- Retry safety: safe; a second call with the same hash is
  `token_taken` and stores nothing.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Writes 1.
- Rules: none

## `users.create`
Whether a user was created: they are not when the email is taken.

- Port: `UserStore.createUser`
- Used by: the dev seed; sign-up from slice C
- Input: the user (`id`, `email`, `name`, `role`, `createdAt`), with
  the email already lower-cased
- Scope: none
- Result: `created | email_taken` (`true` or `false`)
- Guarantee: one statement; the `UNIQUE` index on `email` decides, so
  two creates of one email cannot both land.
- Retry safety: safe; a second call with the same email is
  `email_taken`.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Writes at most 1.
- Rules: none

## `users.find_by_email`
The user with an email, or none.

- Port: `UserStore.findUserByEmail`
- Used by: the dev seed; sign-in from slice B
- Input: an email, lower-cased
- Scope: none
- Result: the user (`id`, `email`, `name`, `role`, `disabled`,
  `emailVerifiedAt`, `createdAt`), or `null`
- Guarantee: one statement.
- Retry safety: safe; it reads only.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Reads at most 1 row, by the `UNIQUE`
  index on `email`; writes none.
- Rules: none
