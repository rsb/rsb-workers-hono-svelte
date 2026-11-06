import type { ApiError, Envelope, TodoReply } from "@todo/contract-api";
import type { Filter } from "#lib/filter.ts";
import { getTodoCounts, getTodos } from "../api/todos.ts";

/**
 * The page's data: the list, or the shell's `signed_out` when the runner
 * refused the read as `unauthenticated`. `todos` are the ones the filter
 * lists. `active` and `completed` count every todo, whatever the filter:
 * the counter, mark all and Clear completed use them.
 */
export type TodosPage =
  | { state: "list"; filter: Filter; todos: TodoReply[]; active: number; completed: number }
  | { state: "signed_out" };

/**
 * What a refused read makes of the page. `unauthenticated` is the shell's
 * `signed_out`: every todo operation requires a member, and the runner
 * refuses an anonymous actor before any todo is read. Every other kind is
 * `accounts.error.failed`. So is `forbidden`, for every reason, until D:
 * `role` cannot happen while every todo operation requires only a member,
 * and D draws `accounts.error.forbidden` for it; `account_disabled` is
 * `failed` until D (`feature-accounts-shell.md`, Views). Every kind and
 * every reason must be placed, so a new one does not compile until it is.
 */
const refusal = (refused: ApiError): "signed_out" | "failed" => {
  switch (refused.kind) {
    case "unauthenticated":
      return "signed_out";
    case "forbidden":
      switch (refused.reason) {
        case "role":
        case "account_disabled":
        case "channel":
          return "failed";
        default: {
          const unplaced: never = refused.reason;
          return unplaced;
        }
      }
    case "validation":
    case "not_found":
    case "limit":
    case "too_large":
    case "internal":
      return "failed";
    default: {
      const unplaced: never = refused;
      return unplaced;
    }
  }
};

/**
 * The page when any of its reads failed: `signed_out` if each refusal was
 * `unauthenticated`, or else a fault, thrown: `handleError` logs it and
 * makes it `accounts.error.failed` (a 500), which `+error.svelte` draws
 * in the frame (`feature-todos-list.md`, Views).
 */
const refused = (replies: Envelope<unknown>[]): TodosPage => {
  const outcomes = replies.flatMap((reply) => (reply.ok ? [] : [refusal(reply.error)]));
  if (outcomes.every((outcome) => outcome === "signed_out")) {
    return { state: "signed_out" };
  }
  throw new Error("a read the todos page needs failed", {
    cause: replies.flatMap((reply) => (reply.ok ? [] : [reply.error])),
  });
};

/**
 * `/`: the full list, with both counts counted from it here; the list is
 * needed anyway (deviation 5).
 */
async function loadAll(api: Pick<Fetcher, "fetch">): Promise<TodosPage> {
  const reply = await getTodos(api);
  if (!reply.ok) {
    return refused([reply]);
  }

  const todos = reply.data;
  const active = todos.filter((todo) => !todo.completed).length;
  const completed = todos.length - active;
  return { state: "list", filter: "all", todos, active, completed };
}

/**
 * `/active` and `/completed`: the API filters the list and counts every
 * todo (deviation 5). The two calls run side by side; if either fails the
 * page fails as a whole, as a failed list does.
 */
async function loadFiltered(api: Pick<Fetcher, "fetch">, filter: "active" | "completed"): Promise<TodosPage> {
  let completedParam: "true" | "false" = "false";
  if (filter === "completed") {
    completedParam = "true";
  }

  const listing = getTodos(api, { completed: completedParam });
  const counting = getTodoCounts(api);
  const [listed, counted] = await Promise.all([listing, counting]);
  if (!listed.ok || !counted.ok) {
    return refused([listed, counted]);
  }

  const todos = listed.data;
  const { active, completed } = counted.data;
  return { state: "list", filter, todos, active, completed };
}

/**
 * Loads the page's data for a filter. Signed out is data the page shows;
 * a failed read is thrown, as a 500, for the shell's error view.
 */
export async function loadTodos(api: Pick<Fetcher, "fetch">, filter: Filter): Promise<TodosPage> {
  if (filter === "all") {
    return loadAll(api);
  }
  return loadFiltered(api, filter);
}
