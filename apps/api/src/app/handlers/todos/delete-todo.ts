import type { DeletedReply } from "@todo/contract-api";
import type { Context, Env } from "hono";
import type { DeleteTodo } from "@todo/operations/todos/delete-todo.ts";
import { mapFailure, success } from "../present.ts";

/** `DELETE /todos/:id`: delete, then present the id. It has no body to read. */
export const deleteTodo = (deleteTodo: DeleteTodo) => async (c: Context<Env, "/todos/:id">) => {
  // Any id is asked for as it is; one no todo has is not found.
  const id = c.req.param("id");

  // It runs as the actor the gate attached. Deleting can fail for the user
  // (no session, or no such todo of theirs) or for us (the store).
  const deleted = await deleteTodo(c.get("actor"), id);
  if (!deleted.ok) {
    return mapFailure(c, deleted.error);
  }

  const reply: DeletedReply = { id: deleted.value };
  return success(c, reply);
};
