# Todo access

Who may run each operation (L39, L43). Authorization is declared here
once. `tooling/access/` generates `packages/business/src/access.ts`
from this file, and the shared runner (`packages/operations/src/run.ts`)
applies each row before the operation's body runs. A delivery may
mirror a row, for ordering or for OpenAPI's `security`; it never
decides one.

One row per operation construct builds. A missing row, or a row whose
operation construct does not build, fails generation (`check:access`).
A probe, such as `GET /health`, runs no operation and has no row.

## Columns

- `Requires`: the least actor the operation runs for, one of:
  - `anonymous`: any request, with or without a session;
  - `member`: a signed-in user, any role;
  - `verified_member`: a member whose email is verified;
  - `admin`: a user whose role is `admin`.

  An actor below it is refused before the body: an anonymous actor as
  `unauthenticated`, a signed-in one as `forbidden` with the reason
  `role`.
- `Scope`: what the operation hands the store (L43):
  - `own`: the actor's own rows, `{ ownerId }`;
  - `any`: every row, `{ any: true }`, for an admin;
  - `n/a`: the operation reads or writes no owned row.

## Operations

| Operation | Use case | Requires | Scope |
| --- | --- | --- | --- |
| `addTodo` | `use-cases/todos/add-a-todo.md` | `member` | `own` |
| `listTodos` | `use-cases/todos/list-todos.md` | `member` | `own` |
| `countTodos` | `use-cases/todos/count-todos.md` | `member` | `own` |
| `updateTodo` | `use-cases/todos/change-a-todo.md` | `member` | `own` |
| `setAllCompleted` | `use-cases/todos/mark-all-completed.md` | `member` | `own` |
| `deleteTodo` | `use-cases/todos/remove-a-todo.md` | `member` | `own` |
| `deleteCompleted` | `use-cases/todos/clear-completed.md` | `member` | `own` |
| `currentSession` | `use-cases/auth/current-session.md` | `anonymous` | `n/a` |
| `signIn` | `use-cases/auth/sign-in.md` | `anonymous` | `n/a` |
| `signOut` | `use-cases/auth/sign-out.md` | `member` | `own` |
| `signOutEverywhere` | `use-cases/auth/sign-out-everywhere.md` | `member` | `own` |
| `listSessions` | `use-cases/auth/list-sessions.md` | `member` | `own` |

Every todo operation is `own` in slice A, the admin's included: the
seeded admin sees only their own list. `any` is in the type and the
store from A, and no operation uses it until D (handoff 23, Q5).

`signIn` is `anonymous` and `n/a`: there is no actor to scope by until
it succeeds, and it runs for a signed-in one too, whose session it
ends (L49). The three session operations are `own`: an actor ends and
lists only their own sessions (L50, L51).
