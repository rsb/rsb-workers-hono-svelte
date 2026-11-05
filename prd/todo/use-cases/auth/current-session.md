# Current session

## Intent
Say who the request acts for, with the name and email the frame shows.

## Serves
- `prd/todo/features/feature-accounts-shell.md` › Reads, the actor:
  the shell reads it once per page load.
- Deviation 21; the shell's scenarios A.1 to A.6.

## Input
- The actor and, for a signed-in actor, the profile (`name`, `email`),
  both attached by the `authenticate` gate (L37, L39). It reads nothing
  of its own: the gate's one statement already read the user's row.
- Whether the gate found a session cookie that names no live session.

## Given
none

## Effects
None. It changes nothing; a session's touch is the gate's, after the
response (L40).

## Result
The actor (`anonymous`, or the user's id, role and whether their email
is verified), the profile for a signed-in actor, and `clearCookie`:
true when the request's session cookie names no live session, so the
BFF deletes it. The api never writes `Set-Cookie` (L40).

## Refused
none. What the gate refuses (an unknown bearer token, a disabled
user's session) is refused before this runs, by the gate.

## Guarantees
none

## Atomic
Nothing to keep atomic: the actor and the profile come from the gate's
one statement, so they describe the same moment.
