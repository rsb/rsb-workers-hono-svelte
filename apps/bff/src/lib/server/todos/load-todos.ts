import type { TodoReply } from "@todo/contract-api";
import { getTodos } from "../api/todos.ts";
import { SOMETHING_WENT_WRONG } from "./messages.ts";

export type TodosPage = { todos: TodoReply[]; error: string | null };

/** The page's data. A failure is shown on the page, as data, not thrown. */
export async function loadTodos(api: Pick<Fetcher, "fetch">): Promise<TodosPage> {
  const reply = await getTodos(api);
  if (!reply.ok) {
    return { todos: [], error: SOMETHING_WENT_WRONG };
  }

  return { todos: reply.data, error: null };
}
