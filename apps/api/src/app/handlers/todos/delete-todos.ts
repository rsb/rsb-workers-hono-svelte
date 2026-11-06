import { DeleteTodosQuery } from "@todo/contract-api";
import type { Context } from "hono";
import type { DeleteCompleted } from "@todo/operations/todos/delete-completed.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateQuery } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** `DELETE /todos?completed=true`: validate the query, delete every completed todo of the actor's, then present the rest. */
export const deleteTodos = (deleteCompleted: DeleteCompleted) => async (c: Context) => {
  // Only `completed=true` deletes; no query is refused, never "delete all".
  const query = validateQuery(c, DeleteTodosQuery);
  if (!query.ok) {
    return userFailure(c, query.error);
  }

  // It runs as the actor the gate attached, so it clears their todos. The
  // runner refuses an anonymous one; the store can fail.
  const deleted = await deleteCompleted(c.get("actor"));
  if (!deleted.ok) {
    return mapFailure(c, deleted.error);
  }

  const reply = deleted.value.map(presentTodo);
  return success(c, reply);
};
