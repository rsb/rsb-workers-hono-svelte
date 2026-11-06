# Sign in

## Intent
Prove an email and password belong to an account and start a new
session on this device.

## Serves
- `prd/todo/features/feature-accounts-sign-in.md` › sign in: the page's
  one action. Every sign-in method converges here (explainer §7); B
  draws only the password.
- Threats rows 3 (rotation) and 7 (enumeration, its sign-in half), and
  row 1's login-CSRF case, which the `channel` gate refuses before this
  runs (L49).

## Input
- A `SignIn`: an email and a password. Assumes `email.length`,
  `email.shape` and `password.given`. The email arrives trimmed and
  lower-cased; the password exactly as typed.
- The id of the session the request presented, when the `authenticate`
  gate found it live. Absent for an anonymous actor.
- A fresh session id from the id source (D13) and a fresh raw token
  (32 random bytes); the store sees only the token's SHA-256 hash
  (L40).
- What the session shows later in Sessions (L51): a label from the
  forwarded `User-Agent` ("Firefox on Linux"), and the city, when the
  request carries one. Neither is checked or trusted; both are display
  only.
- `now`. No scope: there is no actor to scope by until this succeeds,
  so its access row says `anonymous` and `n/a`.

## Given
none

## Effects
- One user and their password credential are read by email, in one
  statement (`data/identity.md › credentials.find_for_sign_in`).
- The password is checked by the hasher: NFKC, HMAC-SHA256 with the
  pepper the credential names, then Argon2id against the stored PHC
  string (L48). For an unknown email the hasher checks a fixed dummy
  PHC string at the current parameters instead, so both refusals cost
  one Argon2id run.
- On success, in one batch (`data/identity.md › identity.sign_in`):
  - a new `cookie` session is stored, with its idle window and absolute
    lifetime from the business constants (L40), `touched_at` set to
    `now`, and the label and city;
  - the session the request presented, if any, is ended with
    `ended_reason` `rotated`, whoever it belonged to (threats row 3);
  - when the credential's parameters or pepper are not the current
    ones, the password is hashed again and written back,
    compare-and-set on the old PHC string.
- No external effects. Email verification is not checked in B (C
  refuses `unverified`).

## Result
The raw token and the session's absolute expiry, `{ token, expiresAt }`.
The BFF stores the token as its session cookie and the api never writes
`Set-Cookie` (L40). The token is never logged and never stored raw.

## Refused
- No user has the email, the user has no password, the password does
  not match, or the user is disabled: `invalid_credentials`. The four
  are one refusal, with one status, one body and one cost (threats row
  7). Nothing is stored and the presented session is left as it was.
  shows: `accounts.sign_in.wrong`
- The store fails: `unavailable` or `server`. The batch is one
  transaction, so either no session was started or the caller simply
  holds no token for the one that was.
  shows: `accounts.error.failed`

The input rules refuse before this runs, as `invalid`.
shows: `accounts.sign_in.field_errors`

## Guarantees
none

## Atomic
The new session, the ending of the presented one and a due rehash are
one D1 batch, so a sign-in never leaves the old session alive beside
the new one. The rehash is compare-and-set on the old PHC string: of
two sign-ins that race, one rewrites it and the other changes nothing,
which is not a failure.
