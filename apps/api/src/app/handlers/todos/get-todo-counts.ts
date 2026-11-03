import type { TodoCountsReply } from "@todo/contract-api";
import type { Context } from "hono";
import type { CountTodos } from "@todo/operations/todos/count-todos.ts";
import { mapFailure, success } from "../present.ts";

/** `GET /todos/counts`: nothing to validate; count every todo, then present. */
export const getTodoCounts = (countTodos: CountTodos) => async (c: Context) => {
  // No business rule refuses a count, but the store can fail.
  const counted = await countTodos();
  if (!counted.ok) {
    return mapFailure(c, counted.error);
  }

  const reply: TodoCountsReply = { active: counted.value.active, completed: counted.value.completed };
  return success(c, reply);
};
