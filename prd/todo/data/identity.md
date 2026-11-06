# Data cases: identity

The data spec for the identity database (L42, L46): one entry per store
call, saying what the call promises and costs, never how it is written.
The SQL stays hand-written under `packages/data/d1/src/identity/`. Each
entry's Cost line is the number
`packages/data/d1/test/unit/budgets.test.ts` asserts; a change to one
changes the other in the same commit (L36). Use cases and features
cite an entry as `data/identity.md › <id>`.

Database: `IDENTITY_DB` (the D1 database `todo-identity`)
Tables: `users`, `sessions`, `credentials`
(`packages/data/d1/migrations/identity/`: `0001_users_sessions.sql`,
and `0002_credentials.sql` for `credentials` and the sessions columns
slice B adds). The `verifications` table waits for slice C.

Every entry:
- Failures: `unavailable` when D1 names a transient or quota error,
  `server` for anything else, our own bugs included
  (`packages/data/d1/src/classify.ts`). The D1 error stays the cause.
- Times are milliseconds since the epoch, as integers; the caller
  passes `now`, so no call reads a clock.
- A user's id is minted once, by the id source, when the user is
  created (D13, L42). It is the only key the app database holds.
- A call that finds a row by its credential or its key takes no scope:
  it runs before there is an actor to scope by. The Sessions page's
  calls (`sessions.end`, `sessions.end_all`, `sessions.list`) run for a
  signed-in actor and take their scope, `{ ownerId }`, the actor's user
  id (L51, amending slice A's "no call takes a scope").
- A session is live when `ended_at` is null, `now` is before
  `expires_at`, and `idle_until` is null or `now` is before it: the
  `authenticate` gate's test, written in SQL where a call filters on it.
- `ended_reason` is one of `rotated` (a sign-in replaced it),
  `signed_out` and `signed_out_everywhere`. Slice C adds
  `password_changed`.

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
  NULL AND idle_until < ?`, so two touches that race move it once, and
  an ended session is never touched back to life (threats row 10). It
  sets `touched_at` to `now` with the window, which is what last active
  reads (L51). The new `idleUntil` is never past `expiresAt`: the gate
  caps it.
- Retry safety: safe; it sets a value and a second call is skipped.
- Failures: `unavailable`, `server`; the binding logs them and the
  request has already been answered
- Cost: 1 round trip, 1 statement. Finds the row by primary key; writes
  at most 1. At most once per session per half idle window.
- Rules: none

## `identity.sign_in`
A sign-in's writes, as one batch: the new session, the presented
session ended, and a due rehash. It writes `sessions` and
`credentials`, so its id names the database, not a table.

- Port: `SignInStore.recordSignIn`
- Used by: sign-in (L49); the dev seed (`apps/api/scripts/seed-dev.ts`)
  and the integration seed (`apps/api/test/integration/seed-sessions.ts`),
  with neither option, so the seeds write through sign-in's own store
- Input: the new session (`id`, `tokenHash`, `userId`, `channel`,
  `createdAt`, `idleUntil`, `expiresAt`, and `label` and `city`, either
  of which may be null), and two options:
  - `rotate`: the id of the session the request presented, ended with
    `ended_reason` `rotated` if it is still open;
  - `rehash`: the user, the new PHC string, its pepper id, and the PHC
    string the credential held when it was read.
- Scope: none
- Result: `{ started, rehashed }`. `started` is `started | token_taken`
  (`true` or `false`): taken when a row already has that token hash.
  `rehashed` is `true` when the credential still held the old PHC string
  and was rewritten, `false` when another write got there first, and
  absent without `rehash`.
- Guarantee: one D1 batch, so one transaction: the insert, with
  `touched_at` at `createdAt` and only the token's hash stored, never the
  raw token (L40); then the rotation's `UPDATE … WHERE id = ? AND
  ended_at IS NULL`, at `createdAt`; then the rehash, compare-and-set:
  `UPDATE credentials SET secret = ?, pepper_id = ?, updated_at = ?
  WHERE user_id = ? AND kind = 'password' AND secret = ?`, its change
  count the result (L48, L43's style). The rehash has no entry of its
  own: it is never written outside this batch. A taken token hash
  stores nothing and the batch's other statements still run; with 256
  random bits it does not happen, and the operation answers it as
  `server`.
- Retry safety: safe; a second call with the same hash is
  `token_taken`, the rotation is already done, and the rehash's old PHC
  string no longer matches.
- Failures: `unavailable`, `server`
- Cost: 1 round trip in every case. Without a presented session or a
  due rehash: 1 statement, writes at most 1. With a presented session and no
  due rehash: 2 statements, writes at most 2. With a due rehash and no
  presented session: 2 statements, writes at most 2. With both: 3
  statements, writes at most 3. The rotated session and the credential
  are each found by primary key.
- Rules: none

## `sessions.end`
Whether one of the actor's sessions was ended: it is not when it had
already ended.

- Port: `SessionEnd.endSession`
- Used by: sign-out
- Input: the session's id, the `ended_reason` (`signed_out`), and `now`
- Scope: `{ ownerId }`
- Result: `ended | already_ended` (`true` or `false`); a session that is
  not the owner's is `already_ended` too, and nothing is written
- Guarantee: one statement, `UPDATE … SET ended_at = ?, ended_reason
  = ? WHERE id = ? AND user_id = ? AND ended_at IS NULL`, so two
  sign-outs that race end it once.
- Retry safety: safe; a second call is `already_ended`.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Finds the row by primary key; writes
  at most 1.
- Rules: none

## `sessions.end_all`
How many of the actor's live sessions were ended.

- Port: `SessionEnd.endAllSessions`
- Used by: sign-out-everywhere
- Input: the `ended_reason` (`signed_out_everywhere`), and `now`
- Scope: `{ ownerId }`
- Result: the number of sessions ended, 0 or more
- Guarantee: one statement, `UPDATE … WHERE user_id = ?` and live, so
  every session live when it runs ends together. A session that is
  already over, ended or expired, is left as it is.
- Retry safety: safe; a second call ends 0.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Finds the rows by the index on
  `user_id`; writes one per live session of the user, which nothing
  bounds but the sign-ins within the last absolute lifetime.
- Rules: none

## `sessions.list`
The actor's live sessions, most recently touched first, up to a bound.

- Port: `SessionList.listSessions`
- Used by: list-sessions
- Input: `now`
- Scope: `{ ownerId }`
- Result: at most `SESSIONS_LIST_MAX` sessions (`id`, `label`, `city`,
  `createdAt`, `touchedAt`), and `more`: true when live sessions were
  left out by the bound. The caller marks this device; the store does
  not know which it is.
- Guarantee: one statement, `… WHERE user_id = ?` and live, `ORDER BY
  touched_at DESC, id`, `LIMIT` the bound plus one, so `more` costs no
  second read.
- Retry safety: safe; it reads only.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Finds the rows by the index on
  `user_id`; reads at most `SESSIONS_LIST_MAX` + 1 rows; writes none.
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
- Used by: the dev seed. Sign-in reads the user with their credential
  instead (`credentials.find_for_sign_in`).
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

## `credentials.find_for_sign_in`
A user and their password credential, by email, or none.

- Port: `CredentialLookup.findForSignIn`
- Used by: sign-in (L49)
- Input: an email, lower-cased
- Scope: none
- Result: the user (`id`, `role`, `disabled`, `emailVerifiedAt`) and the
  credential (`secret`, the Argon2id PHC string, and `pepperId`), or
  `null` when no user has the email or the user has no password. The
  store reports the row as it is: whether it needs a rehash is the
  operation's to decide, against the business constants (L48), as the
  gate decides a session's liveness.
- Guarantee: one statement, `users JOIN credentials WHERE users.email
  = ? AND credentials.kind = 'password'`, the same shape as the gate's
  `sessions JOIN users`.
- Retry safety: safe; it reads only.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Reads at most 2 rows: the user by the
  `UNIQUE` index on `email`, the credential by primary key; writes none.
- Rules: none

## `credentials.set`
A user's credential of a kind, written whether or not one existed.

- Port: `CredentialStore.setCredential`
- Used by: the dev seed; sign-up and change password from slice C
- Input: the user's id, the `kind` (`password`), the PHC string, its
  pepper id, and `now`
- Scope: none
- Result: nothing
- Guarantee: one statement, `INSERT … ON CONFLICT (user_id, kind) DO
  UPDATE`, so a user has at most one credential of a kind. The password
  itself is never stored, only its PHC string (L48).
- Retry safety: safe; a second call writes the same row.
- Failures: `unavailable`, `server`
- Cost: 1 round trip, 1 statement. Writes 1.
- Rules: none
