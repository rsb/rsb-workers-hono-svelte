# Feature: manage the people who use the app

Id: `accounts.users`
Area: `accounts`
Slice: D (roles and the admin pages, disable user)
Design: `design/2026-11-03-ui-accounts/` (boards named before the
convention; the `pending` list was exported as `users-searching`; see
the map at the end). The product-wide design lines are the root's
C-design.

## Purpose
An admin finds a person's account, sees its details and history, and
disables it, or enables it again, with a reason. It is not a
person's own account (`feature-accounts-profile.md`), and it never
shows their to-dos.

The pages sit in `accounts.shell` as `admin`. A member who opens them
sees `accounts.error.admin_only`.

## Who
`admin`, scope `any`.

## Views

### `accounts.users`
Every account: search, filters by role and status, and a table of
name, email, role, status and last sign-in.

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `accounts.users.default` | the table, with how many accounts match | open: D (list users › result) | `users.default` |
| `accounts.users.empty` | "Just you so far. People appear here once they create an account." | open: D (list users › result: the admin alone) | `users.empty` |
| `accounts.users.no_results` | no account matches; "Check the spelling, or clear the search and filters.", "Clear search and filters" | open: D (list users › result, none for the search) | `users.no-results` |
| `accounts.users.pending` | the table while a search runs | open: D (bff, while list users runs) | `users.pending` |

### `accounts.user_detail`
One account: details, role, status, access, sessions and recent
changes.

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `accounts.user_detail.default` | the account's email and when it was verified, role, status, last sign-in, created; "Disable account…" | open: D (user detail › result) | `user-detail.default` |
| `accounts.user_detail.reason` | the disable form open, its reason required: "Recorded in the audit list below. Jordan doesn’t see it." | open: D (bff opens the form; disable user › refused, no reason, once its rule is written) | `user-detail.reason` |
| `accounts.user_detail.pending` | "Disabling…", the button disabled | open: D (bff, while disable user runs) | `user-detail.pending` |
| `accounts.user_detail.disabled` | status Disabled with the reason; "Enable account"; the change in Recent changes | open: D (disable user › result: the user is disabled and every session ended, explainer §4) | `user-detail.disabled` |

## Inputs

| Input | Field | Rules |
| --- | --- | --- |
| Search | `q` | open: D |
| Role and status filters | `role`, `status` | open: D |
| Reason | `reason` | open: D |
| Role | `role` | open: D |

## Reads

| Read | Endpoint | Use case | Data cases |
| --- | --- | --- | --- |
| the accounts, searched and filtered | open: D | list users | `data/identity.md`, open |
| one account, its sessions and its changes | open: D | user detail | `data/identity.md`, open |

## Actions

| Action | Endpoint | Use case | Leads to |
| --- | --- | --- | --- |
| search, filter, clear | open: D | list users | `default`; `empty`; `no_results` |
| open an account | none | none | `accounts.user_detail.default` |
| disable | open: D | disable user (a process) | `disabled`; `reason` |
| enable | open | open | `default` |
| save role | open: D | open: D | `default` |
| sign out everywhere, for this account | open | open | `default` |

## Budget
Open: D sets it. A view that needs both databases reads each by id and
merges in the BFF, never by a join (explainer §5).

## Done
None yet. Slice D writes the scenarios.

## Board map
The accounts design was exported before the naming convention. Its
files that are this feature's boards:

| File | Board |
| --- | --- |
| `desktop-light-users.png` | `users.default.desktop.light` |
| `desktop-dark-users.png` | `users.default.desktop.dark` |
| `mobile-dark-users.png` | `users.default.mobile.dark` |
| `desktop-light-users-empty.png` | `users.empty.desktop.light` |
| `desktop-light-users-no-results.png` | `users.no-results.desktop.light` |
| `mobile-light-users-no-results.png` | `users.no-results.mobile.light` |
| `desktop-light-users-searching.png` | `users.pending.desktop.light` |
| `desktop-light-user-detail.png` | `user-detail.default.desktop.light` |
| `mobile-dark-user-detail.png` | `user-detail.default.mobile.dark` |
| `desktop-light-user-detail-disable-reason-required.png` | `user-detail.reason.desktop.light` |
| `mobile-light-user-detail-disable-reason-required.png` | `user-detail.reason.mobile.light` |
| `desktop-light-user-detail-disable-pending.png` | `user-detail.pending.desktop.light` |
| `desktop-light-user-detail-disabled.png` | `user-detail.disabled.desktop.light` |
| `desktop-dark-user-detail-disabled.png` | `user-detail.disabled.desktop.dark` |

`desktop-light-users-forbidden-member.png` is `accounts.error`'s, in
`feature-accounts-shell.md`. Every state has a board.
