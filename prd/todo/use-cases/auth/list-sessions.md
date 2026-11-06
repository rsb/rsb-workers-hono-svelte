# List sessions

## Intent
Show the actor where they are signed in: each live session, this device
marked, with when it was last active.

## Serves
- `prd/todo/features/feature-accounts-profile.md` › the Sessions
  section, and its "Signed in on N devices".

## Input
- The id of the session the request presented, as the `authenticate`
  gate found it live: it is the one marked "this device".
- The actor's own scope, `{ ownerId }`, which the runner hands it as
  the operation's access row says (L43). Every session below is one of
  the actor's.
- `now`, which decides which sessions are live.

## Given
none

## Effects
None. It reads the actor's live sessions in one statement
(`data/identity.md › sessions.list`) and changes nothing.

## Result
At most `SESSIONS_LIST_MAX` sessions, most recently touched first, each
with its id, label, city, when it started and when it was last touched,
and whether it is this device. When more were live than the bound, the
result says so: the count stops at the bound, and the page words it
that way. Last active is coarse: a touch writes at most once per half
idle window, so the data cannot say more than the day (L51).

## Refused
- The store fails: `unavailable` or `server`.
  shows: `accounts.error.failed` (the page's load fails)

The runner refuses an anonymous actor as `unauthenticated` before this
runs.

## Guarantees
none

## Atomic
One statement, so the list describes one moment.
