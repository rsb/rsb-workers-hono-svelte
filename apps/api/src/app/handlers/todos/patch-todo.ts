import { PatchTodoBody } from "@todo/contract-api";
import type { Context, Env } from "hono";
import type { UpdateTodo } from "@todo/operations/todos/update-todo.ts";
import type { toTodoPatch } from "@todo/valid/todos/todo-patch.ts";
import { invalidOf } from "../messages.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateBody } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** The validator construct gives this handler (L33). */
type ToTodoPatch = typeof toTodoPatch;

/** `PATCH /todos/:id`: validate the body, make it a patch, update, then present. */
export const patchTodo = (updateTodo: UpdateTodo, toTodoPatch: ToTodoPatch) => async (c: Context<Env, "/todos/:id">) => {
  // Any id is asked for as it is; one no todo has is not found.
  const id = c.req.param("id");

  // The body must be JSON, shaped as the contract says.
  const body = await validateBody(c, PatchTodoBody);
  if (!body.ok) {
    return userFailure(c, body.error);
  }

  // The patch must follow the business rules: a title's, and completed is true or false.
  const patch = toTodoPatch({ title: body.value.title, completed: body.value.completed });
  if (!patch.ok) {
    return userFailure(c, invalidOf(patch.error));
  }

  // It runs as the actor the gate attached. Updating can fail for the user
  // (no session, or no such todo of theirs) or for us (the store).
  const updated = await updateTodo(c.get("actor"), id, patch.value);
  if (!updated.ok) {
    return mapFailure(c, updated.error);
  }

  const reply = presentTodo(updated.value);
  return success(c, reply);
};
