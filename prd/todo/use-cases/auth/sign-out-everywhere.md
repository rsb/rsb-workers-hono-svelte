# Sign out everywhere

## Intent
End every session the actor holds, this device's included.

## Serves
- `prd/todo/features/feature-accounts-profile.md` › sign out everywhere,
  from the Sessions section.
- Threats row 10. No re-authentication (L50): this device's session ends
  too, so a cookie thief who runs it gains nothing but a forced sign-in.
  This meets the threat and departs from ASVS 7.5.2's letter.

## Input
- The actor's own scope, `{ ownerId }`, which the runner hands it as
  the operation's access row says (L43). Every session below is one of
  the actor's.
- `now`.

## Given
none

## Effects
Every live session of the actor is ended: `ended_at` is `now` and
`ended_reason` is `signed_out_everywhere`
(`data/identity.md › sessions.end_all`). Another device finds itself
signed out on its next request. No external effects.

## Result
Nothing. The BFF deletes this device's cookie, as for sign out.

## Refused
- The store fails: `unavailable` or `server`. Whether the sessions were
  ended is not known to the caller; running it again is safe.
  shows: `accounts.error.failed`

The runner refuses an anonymous actor as `unauthenticated` before this
runs.

## Guarantees
none

## Atomic
One statement, so every session live when it runs is ended together.
A session started after it, by a sign-in elsewhere, is not. Ending some
sessions while keeping this one is not drawn; if it is, it needs slice
C's re-authentication (L50).
