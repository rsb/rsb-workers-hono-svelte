// Generated from prd/todo/access.md by tooling/access/generate.ts. Do not edit: change the spec and regenerate.

/** The least actor an operation runs for: any request, a signed-in user, one whose email is verified, an admin. */
export type Requires = "anonymous" | "member" | "verified_member" | "admin";

/** What an operation hands the store: the actor's own rows, every row, or no owned row. */
export type ScopeKind = "own" | "any" | "n/a";

/** One operation's row: its use case, the least actor it runs for, and the scope it is handed. */
export type AccessRow = { readonly useCase: string; readonly requires: Requires; readonly scope: ScopeKind };

/** Every operation construct builds, with its row. The runner applies a row before the body runs. */
export const access = {
  addTodo: { useCase: "use-cases/todos/add-a-todo.md", requires: "member", scope: "own" },
  listTodos: { useCase: "use-cases/todos/list-todos.md", requires: "member", scope: "own" },
  countTodos: { useCase: "use-cases/todos/count-todos.md", requires: "member", scope: "own" },
  updateTodo: { useCase: "use-cases/todos/change-a-todo.md", requires: "member", scope: "own" },
  setAllCompleted: { useCase: "use-cases/todos/mark-all-completed.md", requires: "member", scope: "own" },
  deleteTodo: { useCase: "use-cases/todos/remove-a-todo.md", requires: "member", scope: "own" },
  deleteCompleted: { useCase: "use-cases/todos/clear-completed.md", requires: "member", scope: "own" },
  currentSession: { useCase: "use-cases/auth/current-session.md", requires: "anonymous", scope: "n/a" },
  signIn: { useCase: "use-cases/auth/sign-in.md", requires: "anonymous", scope: "n/a" },
  signOut: { useCase: "use-cases/auth/sign-out.md", requires: "member", scope: "own" },
  signOutEverywhere: { useCase: "use-cases/auth/sign-out-everywhere.md", requires: "member", scope: "own" },
  listSessions: { useCase: "use-cases/auth/list-sessions.md", requires: "member", scope: "own" },
} as const satisfies Record<string, AccessRow>;

/** An operation that has a row. */
export type OperationName = keyof typeof access;
