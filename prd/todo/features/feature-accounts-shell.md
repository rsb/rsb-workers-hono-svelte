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
| `accounts.shell.signed_out` | the top bar with "Sign in" (not on the sign-in page itself); in place of the list, "Sign in to see your list. Your to-dos are kept with your account." and "Sign in". "Create an account" is added in C, with its page | `bff, over the runner › unauthenticated`: authenticate › `anonymous` (no cookie, or one that names no live session, which the BFF then deletes), and the page's read, list-todos, is refused by the runner, which requires `member` | `shell.signed-out` (drawn with the two links slice A leaves out) |
| `accounts.shell.member` | the top bar with "Todos" and the account button with the person's initials; the page inside | `authenticate › member`: an actor whose role is `member` | `shell.member` |
| `accounts.shell.admin` | as `member`; the "Users" link is added in D, with its page | `authenticate › admin`: an actor whose role is `admin` | drawn only with the menu open (`shell.menu-open`, as admin) |
| `accounts.shell.menu_open` | the account menu open over the page: name and email, "Admin" for an admin, then Todos; Profile and Sign out from B, and Users (admin only) from D | `bff` (no chain runs) | `shell.menu-open` |
| `accounts.shell.signed_out_notice` | `signed_out`, with the notice "You’re signed out on this device." above it | `bff`: the sign-out action sends the browser to `/?signed-out`, and the list's page shows the notice over `signed_out` only, so the address never tells a signed-in person they are signed out | `shell.signed-out-notice` |

There is no redirect: with no cookie the BFF renders `signed_out` with
no list, and "Sign in" leads to `/sign-in` (B). The shell shows a link
only when its page exists: "Sign in" from B, "Create an account" from
C, "Users" from D, "Profile" from B. The boards draw them
all; the frame renders those whose pages exist.

The chain produces one result no board shows: authenticate › refused
`forbidden`, reason `account_disabled`, a live session whose user is
disabled. It is `open: D (disables users)`; until then the BFF renders
`accounts.error.failed` for it, as for any reply it cannot place.

The account fields the frame shows (initials, name, email) and the
"current page" mark in the top bar are read with the actor; they are
not states.

### `accounts.error`
What a page shows in the frame when it cannot show itself: a code
line, a title, a sentence, and "Try again" or "Go to your to-dos".

| State | The user sees | Produced by | Board |
| --- | --- | --- | --- |
| `accounts.error.not_found` | "404", "This page doesn’t exist", "The address may be mistyped, or the page has moved." | `bff`: no page has that path | `error.not-found` |
| `accounts.error.forbidden` | "403", "You don’t have access to this page", "It’s limited to some accounts. If you think you should have access, ask an admin." | `open: D (every todo operation requires only member)`. Then `bff, over the runner › forbidden`: a signed-in actor without the `requires` its operation names, on every route but the users pages | `error.forbidden` |
| `accounts.error.admin_only` | "403 · /users", "Users is for admins", and who the person is signed in as, and their role | `open: D (the users pages)`. Then `bff, over the runner › forbidden`, the same result as `forbidden`: the chain does not tell the two apart, and the BFF chooses `admin_only` from the route, when the refused read is a users page's | `error.admin-only` |
| `accounts.error.failed` | "Something went wrong", "That didn’t go through — nothing was changed. Try again.", with "Try again" | `list-todos › unavailable or server`, and the same for count-todos, or the `authenticate` gate when its store fails: any read the page needs; the api's reply is `internal` | `error.failed` |

## Inputs
None.

## Reads

| Read | Endpoint | Use case | Data cases |
| --- | --- | --- | --- |
| the actor, with the name and email the frame shows | `GET /sessions/current`, once per page load | current-session, over what the `authenticate` gate attached | `data/identity.md › sessions.find` (the gate's statement; the reply needs none of its own) |

## Actions

| Action | Endpoint | Use case | Data cases | Leads to |
| --- | --- | --- | --- | --- |
| open or close the account menu | none | bff | none | `menu_open`, or back |
| sign out | `DELETE /sessions/current` | `use-cases/auth/sign-out.md` | `data/identity.md › sessions.end` | `signed_out_notice`; `accounts.error.failed` |
| try again | the page's own read | the page's | the page's | the page's state, or `accounts.error.failed` again |

## Sign out
Sign out is a POST from the account menu to `/sign-out`, never a GET
(threats row 2), and a whole-page navigation, so what the page held in
memory goes with the session. The BFF asks the api to end this
device's session, then sends an expiring `Set-Cookie` for the session
cookie and `Clear-Site-Data: "cache"` as a courtesy, and sends the
browser to `/?signed-out` (L50). Not `"cookies"`: it reaches every
cookie of the registrable domain, and on a shared parent domain that
signs the person out of its other apps; the expiring cookie already
deletes the one this app owns. The api writes no
`Set-Cookie` (L40). `unauthenticated` from the api, a session another
sign-out, a sign-out everywhere or a rotation ended first, is signed
out too: the outcome the person asked for holds. Any other refusal is
`accounts.error.failed`, with the cookie kept, since whether the
session ended is not known and signing out again is safe. Opening
`/sign-out` goes to the list and signs nobody out.

Every page drawn for a signed-in person answers
`Cache-Control: no-store`, so no cache keeps it and Back after sign-out
asks again and shows no list.

## Budget
The actor read is one api call per page load, `GET /sessions/current`,
asserted in `apps/bff/test/unit/budgets.test.ts`. On the api every
gated request costs 1 identity round trip, the gate's: 1 statement, at
most 2 rows read and none written on the steady path. The actor read
adds no statement of its own. When the gate says `refreshDue`, 1 write
follows the response (`sessions.touch`), at most once per session per
half idle window. Asserted in `apps/api/test/unit/budgets.test.ts` and
`packages/data/d1/test/unit/budgets.test.ts`.

Sign out is one api call, `DELETE /sessions/current`, asserted in
`apps/bff/test/unit/budgets.test.ts`; the list it sends the browser to
is that page's load. On the api it costs the gate's lookup and 1 write
(`sessions.end`), asserted in `apps/api/test/unit/budgets.test.ts` and
`packages/data/d1/test/unit/budgets.test.ts`.

## Done
E2e runs these through the BFF, with the dev seed's member and admin
sessions. Each cites the deviation or the decision it comes from. B
and D write theirs.

### A Ownership without login
1. *Given* no session cookie, *when* I open `/`, *then* I see "Sign in
   to see your list", no list, and no links in the top bar but "Sign
   in" (from B). (21)
2. *Given* a session cookie that names no live session, *when* I open
   `/`, *then* I see the same, and the cookie is deleted. (21; L39)
3. *Given* the member's session, *when* I open `/`, *then* the top bar
   shows "Todos" and the account button with the member's initials,
   and the page shows the member's list. (21)
4. *Given* the member's session, *when* I open the account menu,
   *then* it shows the member's name and email, and no "Admin". (21)
5. *Given* the admin's session, *when* I open the account menu, *then*
   it shows the admin's name and email and "Admin", and there is no
   "Users" link. (21; slice A has no users page)
6. *Given* any session, *when* I open `/nowhere`, *then* I see "This
   page doesn’t exist", in the frame. (C-accounts)
7. *Given* the api fails, *when* I open `/`, *then* I see "Something
   went wrong" and "Try again", in the frame. (C-accounts)

### B Sign in and sign out
1. *Given* no session cookie, *when* I open `/`, *then* "Sign in" in the
   top bar and on the page each lead to the sign-in page, whose top bar
   has no "Sign in". (`feature-accounts-sign-in.md`)
2. *Given* the member signed in, *when* I sign out from the account
   menu, *then* I see "You’re signed out on this device." and no list,
   and Back shows no list. (L50) Opening `/sign-out` signs nobody out.
3. *Given* a session signed out, *when* its cookie is presented again,
   *then* it signs nobody in, and the cookie is deleted. (threats row
   10)

B's scenarios sign in through the page first, so a sign-out ends a
session of its own, never the seeded one.

Scenario A.7 is not an e2e scenario, for the reason scenario 1 of the
root gives for health: `test:e2e` starts both Workers. It is the BFF's
unit test of the page load, with a fake binding that fails.

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
