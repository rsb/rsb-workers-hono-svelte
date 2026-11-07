# Feature: look after my account

Id: `accounts.profile`
Area: `accounts`
Slice: B for the sessions part ("sessions page", explainer §8); no
slice yet names the display name, the password change or account
deletion; E for linking a second sign-in method
Design: `design/2026-11-03-ui-accounts/` (boards named before the
convention; see the map at the end). The product-wide design lines
are the root's C-design.

## Purpose
A signed-in person sees their account and changes what is theirs to
change: their display name, their password, where they are signed in,
and whether the account exists at all. It is not another person's
account (`feature-accounts-users.md`) and not changing the email yet:
the page says that is coming.

The page sits in `accounts.shell` as `member` or `admin`.

## Who
`member`, scope `own`; an `admin` sees their own profile the same way.

## Views

### `accounts.profile`
One page of sections: Account (display name, email), Password,
Sign-in methods, Sessions, Delete account.

B draws "Profile" and Sessions only; each other section is added with
the slice that builds it. "Profile" is in the account menu from B
(`accounts.shell.menu_open`). With no session the page shows the
shell's `signed_out`, as the list does: list-sessions requires a
member, and the runner refuses an anonymous actor.

### Sessions
"Sessions", then "Signed in on N devices.", from the one read. A row
per live session: its label ("Firefox on Linux", or "Unknown browser"
when the sign-in's `User-Agent` named nothing the label table knows),
"This device" on the actor's own, and a line with the city, when the
sign-in's request carried one, then last active. This device comes
first, as the board draws it; the rest are most recently active first.
A label on iOS or Android is drawn with a phone, any other with a
laptop; both are display only. Then "Sign out everywhere" and
"Includes this device. You’ll need to sign in again."

Last active is coarse (L51): "Active now" for this device; for another,
from its last touch, "Active in the last day" under 24 hours, then
"Active 1 day ago" under 48, "Active 2 days ago" under 72, and so on,
rounded down. The days are 24-hour periods counted back from when the
page is drawn, not calendar days: the BFF draws the page and does not
know the person's time zone, so the words never say "today" or
"yesterday". The board's "Last
active 3 hours ago" is example copy and changes, and so is its "Safari
on iPhone": the label table names the system, "Safari on iOS".

The read stops at `SESSIONS_LIST_MAX` (50). Above it the count is not
known without a second read, which the page does not make, so it says
"Signed in on more than 50 devices. The 50 most recently active are
listed.", the number being the rows listed, not the constant (L27).

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `accounts.profile.default` | every section at rest; the email marked verified; this device and the others in Sessions; "Sign out everywhere". B draws Sessions only (below) | Sessions: list-sessions › the actor's live sessions (L51). The other sections: open, with the slices that build them | `profile.default` |
| `accounts.profile.edit_name` | the display name as an input, "Enter to save · Esc to cancel", here showing "Display name must be 1 to 64 characters" | open: no slice names display-name edits | `profile.edit-name` |
| `accounts.profile.password_error` | the password form says what is wrong with the current or the new password | open: no slice names the password change | `profile.password-error` |
| `accounts.profile.password_pending` | "Changing password…", the button disabled | open: no slice names the password change | `profile.password-pending` |
| `accounts.profile.password_saved` | "Password changed. Your other device was signed out." | open: no slice names the password change (it ends the other sessions, `ended_reason` `password_changed`, explainer §4) | `profile.password-saved` |
| `accounts.profile.delete_confirm` | the delete section asks to confirm before the account and its to-dos are deleted | open: no slice; deleting an account is a process across both databases (explainer §5) | `profile.delete-confirm` |

## Inputs

| Input | Field | Rules |
| --- | --- | --- |
| Display name | `name` | open (the design words it "1 to 64 characters") |
| Current password | `current` | open |
| New password | `next` | open (the design words it "At least 12 characters") |

## Reads

| Read | Endpoint | Use case | Data cases |
| --- | --- | --- | --- |
| the actor's live sessions | `GET /sessions` | `use-cases/auth/list-sessions.md` | `data/identity.md › sessions.list` |
| the account (name, email, verified) | open: the slice that draws Account | open | `data/identity.md`, open |

## Actions

| Action | Endpoint | Use case | Leads to |
| --- | --- | --- | --- |
| edit the display name | open | open | `default`; `edit_name` |
| change the password | open | open | `password_saved`; `password_error` |
| sign out everywhere | `DELETE /sessions` | `use-cases/auth/sign-out-everywhere.md` (ends every session, this device's included, so no re-authentication: L50) | `accounts.shell.signed_out_notice`; `accounts.error.failed` |
| link Google, add a passkey | none | none | nothing: "Coming" (E) |
| delete the account | open | open (a process) | `delete_confirm`, then signed out |

## Sign out everywhere
A POST from the Sessions section to `/profile?/everywhere`, never a GET
(threats row 2), and a whole-page navigation, as the shell's sign-out
(`feature-accounts-shell.md`, Sign out): the api ends every live
session of the actor's, the BFF deletes this device's cookie with an
expiring `Set-Cookie`, sends `Clear-Site-Data: "cache"`, and sends the
browser to `/?signed-out`. Another device finds itself signed out on its
next request, and its BFF deletes its cookie then (L39).
`unauthenticated` from the api is signed out too; any other refusal is
`accounts.error.failed`, with the cookie kept, since whether the
sessions ended is not known and running it again is safe.

## Budget
The page load is 2 api calls: the frame's actor read and
`GET /sessions`, from which "Signed in on N devices" comes too. Sign
out everywhere is 1 api call, `DELETE /sessions`; the list it sends the
browser to is that page's load. Asserted in
`apps/bff/test/unit/budgets.test.ts`.

On the api, each is the gate's lookup and 1 statement: the list reads
at most `SESSIONS_LIST_MAX` + 1 rows by the index on `user_id` and
writes none (`sessions.list`); sign out everywhere is 1 write
(`sessions.end_all`). Asserted in `apps/api/test/unit/budgets.test.ts`
and `packages/data/d1/test/unit/budgets.test.ts`.

## Done
E2e runs these through the BFF, against the dev seed's member and the
password the seed set. Each browser signs in through the page, so its
session is the test's own.

### B Where I am signed in
1. *Given* the member signed in on this browser and on a phone, *when*
   I open Profile from the account menu, *then* Sessions lists this
   device, marked, with a city and "Active now", and the phone, "Safari
   on iOS", "Active in the last day". (L51) The city is miniflare's stand-in
   `request.cf`: it shows the city crossing the binding to the api, not
   what production's `request.cf` carries.
2. *Given* the member signed in on two browsers, *when* I sign out
   everywhere in one, *then* it lands on the notice with no cookie, the
   other is signed out on its next page load and its cookie deleted,
   and so is the seed's session. (L50; threats row 10) It ends the
   seeded session the other e2e files use, so it runs in its own
   project, after every other.

## Board map
The accounts design was exported before the naming convention. Its
files that are this feature's boards:

| File | Board |
| --- | --- |
| `desktop-light-profile.png` | `profile.default.desktop.light` |
| `mobile-dark-profile.png` | `profile.default.mobile.dark` |
| `desktop-light-profile-display-name-error.png` | `profile.edit-name.desktop.light` |
| `desktop-light-profile-password-error.png` | `profile.password-error.desktop.light` |
| `desktop-dark-profile-password-error.png` | `profile.password-error.desktop.dark` |
| `desktop-light-profile-password-pending.png` | `profile.password-pending.desktop.light` |
| `desktop-light-profile-password-changed.png` | `profile.password-saved.desktop.light` |
| `desktop-light-profile-delete-account-confirm.png` | `profile.delete-confirm.desktop.light` |
| `mobile-light-profile-delete-account-confirm.png` | `profile.delete-confirm.mobile.light` |

Every state has a board.
