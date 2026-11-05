# Feature: create an account and verify my email

Id: `accounts.sign_up`
Area: `accounts`
Slice: C (sign-up with email verification, the first process); E for a
second method
Design: `design/2026-11-03-ui-accounts/` (boards named before the
convention; the `sent` and `verified` boards were exported as
`verify-*`; see the map at the end). The product-wide design lines
are the root's C-design.

## Purpose
A person makes an account with a display name, an email and a
password, proves the email is theirs from the link they are sent, and
can then sign in. It is not signing in (`feature-accounts-sign-in.md`)
and not signing up with Google or a passkey yet.

The page sits in `accounts.shell` as `signed_out`.

## Who
`anonymous`.

## Views

### `accounts.sign_up`
The form, then the "check your email" step, then the "verified" step.
The design draws all three with one component, so they are one view.

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `accounts.sign_up.default` | "Create an account", "One list, yours, on every device.", Display name, Email, Password ("At least 12 characters"), "Create account" | bff (no chain runs until submit) | `sign-up.default` |
| `accounts.sign_up.field_errors` | each field says what is wrong with it | open: C (`valid`, with sign-up's input rules, not written yet) | `sign-up.field-errors` |
| `accounts.sign_up.pending` | "Creating account…", the button disabled | open: C (bff, while sign-up runs) | `sign-up.pending` |
| `accounts.sign_up.sent` | "Verify your email": an email was sent to the address; "Resend email", "Use a different email" | open: C (sign up › result) | `sign-up.sent` |
| `accounts.sign_up.resent` | `sent`, with "Sent again. It can take a minute to arrive." | open: C (resend verification › result) | not drawn |
| `accounts.sign_up.verified` | "Email verified", "Your account is ready. Sign in to start your list.", "Sign in" | open: C (verify the email › result) | `sign-up.verified` |

## Inputs

| Input | Field | Rules |
| --- | --- | --- |
| Display name | `name` | open: C (the design words it "1 to 64 characters") |
| Email | `email` | open: C |
| Password | `password` | open: C (the design words it "At least 12 characters") |

## Reads
None: the form needs nothing before it renders. The `verified` step is
reached from the link in the email.

## Actions

| Action | Endpoint | Use case | Leads to |
| --- | --- | --- | --- |
| create account | open: C | sign up (a process) | `sent`; `field_errors` |
| resend the email | open: C | open: C | `resent` |
| use a different email | none | bff | `default` |
| open the link in the email | open: C | verify the email | `verified` |
| sign in | none | none | `accounts.sign_in.default` |

## Budget
Open: C sets it.

## Done
None yet. Slice C writes the scenarios.

## Board map
The accounts design was exported before the naming convention. Its
files that are this feature's boards:

| File | Board |
| --- | --- |
| `desktop-light-sign-up.png` | `sign-up.default.desktop.light` |
| `mobile-dark-sign-up.png` | `sign-up.default.mobile.dark` |
| `desktop-light-sign-up-field-errors.png` | `sign-up.field-errors.desktop.light` |
| `desktop-dark-sign-up-field-errors.png` | `sign-up.field-errors.desktop.dark` |
| `desktop-light-sign-up-pending.png` | `sign-up.pending.desktop.light` |
| `desktop-light-verify-email-sent.png` | `sign-up.sent.desktop.light` |
| `mobile-light-verify-email-sent.png` | `sign-up.sent.mobile.light` |
| `desktop-light-verify-verified-you-can-sign-in.png` | `sign-up.verified.desktop.light` |

Every state has a board except `accounts.sign_up.resent`, which is in
the design's state list but not drawn.
