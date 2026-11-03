import type { TodoReply } from "@todo/contract-api";
import type { Filter } from "#lib/filter.ts";
import { getTodoCounts, getTodos } from "../api/todos.ts";
import { SOMETHING_WENT_WRONG } from "./messages.ts";

/**
 * The page's data. `todos` are the ones the filter lists. `active` and
 * `completed` count every todo, whatever the filter: the counter, mark all
 * and Clear completed use them.
 */
export type TodosPage = {
  filter: Filter;
  todos: TodoReply[];
  active: number;
  completed: number;
  error: string | null;
};

/** What the page shows when the API fails: no list, and the message. */
const failedPage = (filter: Filter): TodosPage => {
  return { filter, todos: [], active: 0, completed: 0, error: SOMETHING_WENT_WRONG };
};

/**
 * `/`: the full list, with both counts counted from it here; the list is
 * needed anyway (deviation 5).
 */
async function loadAll(api: Pick<Fetcher, "fetch">): Promise<TodosPage> {
  const reply = await getTodos(api);
  if (!reply.ok) {
    return failedPage("all");
  }

  const todos = reply.data;
  const active = todos.filter((todo) => !todo.completed).length;
  const completed = todos.length - active;
  return { filter: "all", todos, active, completed, error: null };
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
    return failedPage(filter);
  }

  const todos = listed.data;
  const { active, completed } = counted.data;
  return { filter, todos, active, completed, error: null };
}

/** Loads the page's data for a filter. A failure is shown on the page, as data, not thrown. */
export async function loadTodos(api: Pick<Fetcher, "fetch">, filter: Filter): Promise<TodosPage> {
  if (filter === "all") {
    return loadAll(api);
  }
  return loadFiltered(api, filter);
}
