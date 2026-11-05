# Feature: see who I am, get around, and sign out

Id: `accounts.shell`
Area: `accounts`
Slice: A for `signed_out`, `member`, `admin`, `accounts.error.not_found`
and `accounts.error.failed`; B for sign-out and `signed_out_notice`;
D for `accounts.error.forbidden` and `accounts.error.admin_only`
Design: `design/2026-11-03-ui-accounts/` (boards named before the
convention: `desktop-light-shell-signed-out.png` is
`shell.signed-out.desktop.light`; see the map at the end). The
product-wide design lines are the root's C-design.

## Purpose
Every page sits in one frame that says who the request acts for, links
to the pages that person may use, and lets them sign out; when a page
cannot be shown, the frame shows why instead. It is not signing in
(`feature-accounts-sign-in.md`) and not the account's settings
(`feature-accounts-profile.md`).

Other features cite `accounts.shell` and `accounts.error` and never
restate them.

## Who
- `accounts.shell`: every actor. `anonymous` sees `signed_out`;
  `member` and `admin` see their own state.
- `accounts.error`: every actor.

## Views

### `accounts.shell`
The frame of every page: the top bar with the product name, the links
the actor may use and the account menu, and the page's own view inside
it.

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `accounts.shell.signed_out` | the top bar with "Sign in"; in place of the list, "Sign in to see your list. Your to-dos are kept with your account.", with "Sign in" and "Create an account" | authenticate › `anonymous` (no cookie, or one that names no live session, which also clears it); then the page's read, list-todos, is refused by the runner: it requires `member` | `shell.signed-out` |
| `accounts.shell.member` | the top bar with "Todos" and the account button with the person's initials; the page inside | authenticate › an actor whose role is `member` | `shell.member` |
| `accounts.shell.admin` | as `member`, with a "Users" link | authenticate › an actor whose role is `admin` | drawn only with the menu open (`shell.menu-open`, as admin) |
| `accounts.shell.menu_open` | the account menu open over the page: name and email, "Admin" for an admin, then Todos, Users (admin only), Profile and Sign out | bff (no chain runs) | `shell.menu-open` |
| `accounts.shell.signed_out_notice` | `signed_out`, with the notice "You’re signed out on this device." | bff, after sign-out; open until B | `shell.signed-out-notice` |

Slice A has no sign-in page: there is no redirect, and with no cookie
the BFF renders `signed_out` with no list. "Sign in" and "Create an
account" have pages behind them from B and C.

The chain produces one result no board shows: authenticate › refused
`account_disabled`, a live session whose user is disabled. It is
`open` until D, which disables users.

The account fields the frame shows (initials, name, email) and the
"current page" mark in the top bar are read with the actor; they are
not states.

### `accounts.error`
What a page shows in the frame when it cannot show itself: a code
line, a title, a sentence, and "Try again" or "Go to your to-dos".

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `accounts.error.not_found` | "404", "This page doesn’t exist", "The address may be mistyped, or the page has moved." | bff: no page has that path | `error.not-found` |
| `accounts.error.forbidden` | "403", "You don’t have access to this page", "It’s limited to some accounts. If you think you should have access, ask an admin." | a page's read › refused by the runner: a signed-in actor without the `requires` its operation names; open until D, since every todo operation requires only `member` | `error.forbidden` |
| `accounts.error.admin_only` | "403 · /users", "Users is for admins", and who the person is signed in as, and their role | the users page's read › refused by the runner: it requires `admin`; open until D | `error.admin-only` |
| `accounts.error.failed` | "Something went wrong", "That didn’t go through — nothing was changed. Try again.", with "Try again" | a page's read › refused `unavailable` or `server` (for the todos page: list-todos or count-todos) | `error.failed` |

## Inputs
None.

## Reads

| Read | Endpoint | Use case | Data cases |
| --- | --- | --- | --- |
| the actor, with the name and email the frame shows | slice A names it: one api call per page load | authenticate (a gate, not a use case) | `data/identity.md`, written in slice A |

## Actions

| Action | Endpoint | Use case | Leads to |
| --- | --- | --- | --- |
| open or close the account menu | none | bff | `menu_open`, or back |
| sign out | open until B | sign out (B): ends this device's session | `signed_out_notice` |
| try again | the page's own read | the page's | the page's state, or `accounts.error.failed` again |

## Budget
Slice A: the actor read is one api call per page load, recorded in the
BFF budgets; on the api, a gated request is 1 identity round trip, at
most 2 rows read and none written on the steady path (handoff 23,
item 7).

## Done
None yet. Slice A writes the scenarios for `signed_out`, `member`,
`admin`, `not_found` and `failed`; B and D write theirs.

## Board map
The accounts design was exported before the naming convention. Its
files that are this feature's boards:

| File | Board |
| --- | --- |
| `desktop-light-shell-signed-out.png` | `shell.signed-out.desktop.light` |
| `desktop-light-shell-member-menu-closed.png` | `shell.member.desktop.light` |
| `desktop-dark-shell-member-menu-closed.png` | `shell.member.desktop.dark` |
| `mobile-light-shell-member-menu-closed.png` | `shell.member.mobile.light` |
| `mobile-dark-shell-member-menu-closed.png` | `shell.member.mobile.dark` |
| `desktop-light-shell-admin-menu-open.png` | `shell.menu-open.desktop.light`, as admin |
| `mobile-dark-shell-admin-menu-open.png` | `shell.menu-open.mobile.dark`, as admin |
| `desktop-light-sign-out-member-menu-open.png` | `shell.menu-open.desktop.light`, as member |
| `mobile-light-sign-out-member-menu-open.png` | `shell.menu-open.mobile.light`, as member |
| `desktop-light-sign-out-signed-out.png` | `shell.signed-out-notice.desktop.light` |
| `desktop-dark-sign-out-signed-out.png` | `shell.signed-out-notice.desktop.dark` |
| `desktop-light-shell-top-bar-component.png` | not a board: the top bar's component sheet, every account and current page |
| `desktop-light-error-404.png` | `error.not-found.desktop.light` |
| `mobile-dark-error-404.png` | `error.not-found.mobile.dark` |
| `desktop-light-error-403.png` | `error.forbidden.desktop.light` |
| `desktop-light-users-forbidden-member.png` | `error.admin-only.desktop.light` |
| `mobile-light-error-403-member-on-users.png` | `error.admin-only.mobile.light` |
| `desktop-light-error-something-went-wrong.png` | `error.failed.desktop.light` |
| `desktop-dark-error-something-went-wrong.png` | `error.failed.desktop.dark` |

Every state has a board except `accounts.shell.admin`, which is drawn
only with its menu open. `shell.menu-open.desktop.light` names two
files, one per account: the board name holds one state, and the
design drew the menu over two.
