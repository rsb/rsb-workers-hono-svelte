import type { TodoReply } from "@todo/contract-api";
import { getTodos } from "../api/todos.ts";
import { SOMETHING_WENT_WRONG } from "./messages.ts";

/**
 * The page's data. `active` is how many todos are not completed: the
 * counter. `completed` is how many are: Clear completed shows when it is
 * not 0.
 */
export type TodosPage = { todos: TodoReply[]; active: number; completed: number; error: string | null };

/**
 * Loads the page's data. A failure is shown on the page, as data, not
 * thrown. Both counts are counted here from the full list; `/` needs the
 * list anyway (deviation 5).
 */
export async function loadTodos(api: Pick<Fetcher, "fetch">): Promise<TodosPage> {
  const reply = await getTodos(api);
  if (!reply.ok) {
    return { todos: [], active: 0, completed: 0, error: SOMETHING_WENT_WRONG };
  }

  const todos = reply.data;
  const active = todos.filter((todo) => !todo.completed).length;
  const completed = todos.length - active;
  return { todos, active, completed, error: null };
}
