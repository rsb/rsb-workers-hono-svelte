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

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `accounts.profile.default` | every section at rest; the email marked verified; this device and the others in Sessions; "Sign out everywhere" | open: B (a read of the actor's own account and sessions) | `profile.default` |
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
| the account and its sessions | open: B | open: B | `data/identity.md`, open |

## Actions

| Action | Endpoint | Use case | Leads to |
| --- | --- | --- | --- |
| edit the display name | open | open | `default`; `edit_name` |
| change the password | open | open | `password_saved`; `password_error` |
| sign out everywhere | open: B | sign out of all devices (ends every session; re-authentication needed) | `accounts.shell.signed_out_notice` |
| link Google, add a passkey | none | none | nothing: "Coming" (E) |
| delete the account | open | open (a process) | `delete_confirm`, then signed out |

## Budget
Open: B sets it for the sessions part.

## Done
None yet.

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
