import { DeleteTodosQuery } from "@todo/contract-api";
import type { Context } from "hono";
import type { DeleteCompleted } from "@todo/operations/todos/delete-completed.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateQuery } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** `DELETE /todos?completed=true`: validate the query, delete every completed todo, then present the rest. */
export const deleteTodos = (deleteCompleted: DeleteCompleted) => async (c: Context) => {
  // Only `completed=true` deletes; no query is refused, never "delete all".
  const query = validateQuery(c, DeleteTodosQuery);
  if (!query.ok) {
    return userFailure(c, query.error);
  }

  // No business rule refuses it, but the store can fail.
  const deleted = await deleteCompleted();
  if (!deleted.ok) {
    return mapFailure(c, deleted.error);
  }

  const reply = deleted.value.map(presentTodo);
  return success(c, reply);
};
