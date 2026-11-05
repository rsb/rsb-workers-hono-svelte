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
| `accounts.sign_in.default` | "Sign in", "Pick up your list where you left it.", Email, Password, "Forgot password?", "Sign in"; Google and passkey marked "Coming" | bff (no chain runs until submit) | `sign-in.default` |
| `accounts.sign_in.field_errors` | each field says what is wrong with it | open: B (`valid`, with sign-in's input rules, not written yet) | `sign-in.field-errors` |
| `accounts.sign_in.pending` | "Signing in…", the button disabled | open: B (bff, while sign-in runs) | `sign-in.pending` |
| `accounts.sign_in.wrong` | "That email and password don’t match an account. Check both and try again." | open: B (sign in › refused, the credentials do not match; the same words whether or not the email has an account) | `sign-in.wrong` |
| `accounts.sign_in.unverified` | "Check your email": the account is not verified yet, a link was sent to the email; "Resend email", "Back to sign in" | open: C (sign in › refused, the email is not verified) | `sign-in.unverified` |

On success the person lands on their list in `accounts.shell.member`
or `accounts.shell.admin`. Every method converges on one use case,
"sign in with a verified identity", which starts the session
(explainer §7).

## Inputs

| Input | Field | Rules |
| --- | --- | --- |
| Email | `email` | open: B |
| Password | `password` | open: B |

## Reads
None: the page needs nothing before it renders.

## Actions

| Action | Endpoint | Use case | Leads to |
| --- | --- | --- | --- |
| sign in | open: B | sign in with a verified identity | the list; `field_errors`; `wrong`; `unverified` |
| resend the verification email | open: C | open: C | `unverified`, with "Sent again." |
| continue with Google, use a passkey | none | none | nothing: "Not available yet." (E) |
| create an account | none | none | `accounts.sign_up.default` |

## Budget
Open: B sets it. The explainer's number for the password hash is about
20 ms of CPU per sign-in (Argon2id, §7).

## Done
None yet. Slice B writes the scenarios.

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
