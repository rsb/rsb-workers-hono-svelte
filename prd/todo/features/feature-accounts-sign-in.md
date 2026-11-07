# Feature: sign in to my list

Id: `accounts.sign_in`
Area: `accounts`
Slice: B (email and password); C for `unverified`; E for a second
method
Design: `design/2026-11-03-ui-accounts/` (boards named before the
convention; see the map at the end). The product-wide design lines
are the root's C-design.

## Purpose
A person who has an account proves it is theirs and gets back to their
list on this device. It is not creating an account
(`feature-accounts-sign-up.md`), not resetting a password, and not
signing in with Google or a passkey yet: the page shows both as coming.

The page sits in `accounts.shell` as `signed_out`.

## Who
`anonymous`.

## Views

### `accounts.sign_in`
Email and password, a link to create an account, and the other ways to
sign in shown as not available yet.

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `accounts.sign_in.default` | "Sign in", "Pick up your list where you left it.", Email, Password, "Sign in"; Google and passkey marked "Coming". "Forgot password?" and "New here? Create an account" are added with their pages, as the shell adds a link (`accounts.shell`) | bff (no chain runs until submit) | `sign-in.default` |
| `accounts.sign_in.field_errors` | each field says what is wrong with it: "Email is required", "Enter a valid email address", "Email must be at most 254 characters"; "Password is required", "Password must be at most 128 characters". The email stays as typed; the password is emptied | `valid` › `toSignIn` (`email.length`, `email.shape`, `password.given`), run by the BFF before it calls the api. The api runs it again, as `invalid`; reaching the api means skew, which the page shows as `accounts.error.failed` | `sign-in.field-errors` |
| `accounts.sign_in.pending` | "Signing in…", the button disabled | bff, while sign-in runs, with JavaScript; without it, the browser's own loading | `sign-in.pending` |
| `accounts.sign_in.wrong` | "That email and password don’t match an account. Check both and try again." The email stays as typed; the password is emptied | sign in › refused `invalid_credentials` (no user has the email, no password, the password does not match, or the user is disabled): the same words, the same status (401) and the same cost whether or not the email has an account (threats row 7) | `sign-in.wrong` |
| `accounts.sign_in.unverified` | "Check your email": the account is not verified yet, a link was sent to the email; "Resend email", "Back to sign in" | open: C (sign in › refused, the email is not verified) | `sign-in.unverified` |

On success the person lands on their list in `accounts.shell.member`
or `accounts.shell.admin`, and the BFF keeps the token as the session
cookie (`HttpOnly`, `SameSite=Lax`, `Secure` when deployed) until the
session's absolute expiry (L40). Every other refusal (`sign-in.md`,
Refused) is `accounts.error.failed`, in the frame. Every method converges on one use case,
"sign in with a verified identity", which starts the session
(explainer §7).

## Inputs

| Input | Field | Rules |
| --- | --- | --- |
| Email | `email` | trimmed, lower-cased; `email.length`, `email.shape` (`rules.md` › `SignIn`) |
| Password | `password` | as typed; `password.given` |

## Reads
None: the page needs nothing before it renders.

## Actions

| Action | Endpoint | Use case | Leads to |
| --- | --- | --- | --- |
| sign in | `POST /sessions` | `use-cases/auth/sign-in.md` (B draws the password; C refuses `unverified`) | the list; `field_errors`; `wrong`; `unverified` (C) |
| resend the verification email | open: C | open: C | `unverified`, with "Sent again." |
| continue with Google, use a passkey | none | none | nothing: "Not available yet." (E) |
| create an account | none | none | `accounts.sign_up.default` (C: the link is added with the page) |

## Budget
The page load is the frame's actor read only, 1 api call
(`feature-accounts-shell.md`, Budget); the page reads nothing of its
own. The sign-in is 1 api call, `POST /sessions`, and the list it
lands on is that page's load. A refusal by the input rules costs no api
call.

On the api, sign-in is 2 identity round trips: the join read
(`credentials.find_for_sign_in`), then one batch (`identity.sign_in`)
with the new session, the ending of a presented one and a due rehash.
A browser that presents a live session adds the gate's lookup, 3. Every
refusal of the credentials costs the one read and nothing more.

Each sign-in checks one Argon2id hash, at m=19456, t=2, p=1, whether
the email has an account or not. Its cost is about 20 ms: minimum of 3
per run, 16-20 ms over the runs of stage 24, wall time in local workerd,
one machine, @phi-ag/argon2 0.6.2. It is recorded, not asserted;
production CPU time is not measured here. Asserted:
`apps/bff/test/unit/budgets.test.ts` (the api call),
`apps/api/test/unit/budgets.test.ts` (the round trips, and one hash
check on every branch) and `packages/data/d1/test/unit/budgets.test.ts`.

## Done
E2e runs these through the BFF, against the dev seed's member and the
password the seed set. Each starts with no session cookie.

### B Sign in with a password
1. *Given* the member's email and password, *when* I sign in, *then* I
   land on my list, signed in on this device, and the cookie is kept
   until the session's absolute expiry. The email is matched trimmed and
   lower-cased. (L40, L47) This is also the proof that the seed's hash,
   made in Node, and the api's, checked in workerd, agree.
2. *Given* a wrong password, and *given* an email with no account,
   *when* I sign in, *then* I see `wrong`, alike, with the same status,
   and I am not signed in. (threats row 7)
3. *Given* a malformed email and an empty password, *when* I sign in,
   *then* each field says what is wrong with it. (L47)
4. *When* I press "Use a passkey", *then* the page says "Not available
   yet." (E)
5. *Given* a sign-in the server has not yet answered, *then* the button
   says "Signing in…" and is disabled; *when* the answer comes, *then* I
   land on my list. The test holds the post until it has looked.

## Board map
The accounts design was exported before the naming convention. Its
files that are this feature's boards:

| File | Board |
| --- | --- |
| `desktop-light-sign-in.png` | `sign-in.default.desktop.light` |
| `desktop-dark-sign-in.png` | `sign-in.default.desktop.dark` |
| `mobile-light-sign-in.png` | `sign-in.default.mobile.light` |
| `desktop-light-sign-in-field-errors.png` | `sign-in.field-errors.desktop.light` |
| `mobile-dark-sign-in-field-errors.png` | `sign-in.field-errors.mobile.dark` |
| `desktop-light-sign-in-pending.png` | `sign-in.pending.desktop.light` |
| `desktop-light-sign-in-wrong-credentials.png` | `sign-in.wrong.desktop.light` |
| `desktop-light-sign-in-check-your-email-unverified.png` | `sign-in.unverified.desktop.light` |

Every state has a board.

`sign-in.field-errors` draws "Enter a valid email address" under
`maya@example`, which is valid under L47 (the WHATWG valid email
address takes a domain with no dot, in the browser and in the api
alike), so the board's input cannot produce its error. The rule stands;
the scenarios use `maya.example`. The PNG is left for the next design
pass.
