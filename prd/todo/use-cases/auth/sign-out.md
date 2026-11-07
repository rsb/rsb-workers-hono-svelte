# Sign out

## Intent
End this device's session.

## Serves
- `prd/todo/features/feature-accounts-shell.md` › sign out, from the
  account menu.
- Threats row 10 (sign-out that does not end the session).

## Input
- The id of the session the request presented, as the `authenticate`
  gate found it live.
- The actor's own scope, `{ ownerId }`, which the runner hands it as
  the operation's access row says (L43). The session must be one of the
  actor's.
- `now`.

## Given
none

## Effects
The session is ended: `ended_at` is `now` and `ended_reason` is
`signed_out` (`data/identity.md › sessions.end`). The next request that
presents its token is anonymous. No external effects.

## Result
Nothing. The BFF deletes its cookie and sends `Clear-Site-Data`; the
api never writes `Set-Cookie` (L40).

## Refused
- The store fails: `unavailable` or `server`. Whether the session was
  ended is not known to the caller; signing out again is safe.
  shows: `accounts.error.failed`

A stale cookie never reaches this: the `authenticate` gate reads an
ended session as anonymous, and the runner refuses an anonymous actor
as `unauthenticated` before this runs. The store's `already_ended` is
reachable only in the race between the gate's read and the end
statement, when another sign-out, a sign-out everywhere or a rotation
ends the session first. It is not a refusal: the outcome the caller
asked for holds.

## Guarantees
none

## Atomic
One statement. A refresh that was due when the request arrived runs
after the response (L40), and `sessions.touch` skips an ended row, so
it cannot bring the session back (threats row 10).
