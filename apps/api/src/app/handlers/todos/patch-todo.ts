import { PatchTodoBody } from "@todo/contract-api";
import type { Context, Env } from "hono";
import type { UpdateTodo } from "@todo/operations/todos/update-todo.ts";
import { toTodoPatch } from "@todo/valid/todos/todo-patch.ts";
import { invalidOf } from "../messages.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateBody } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** `PATCH /todos/:id`: validate the body, make it a patch, update, then present. */
export const patchTodo = (updateTodo: UpdateTodo) => async (c: Context<Env, "/todos/:id">) => {
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

  // Updating can fail for the user (no such todo) or for us (the store).
  const updated = await updateTodo(id, patch.value);
  if (!updated.ok) {
    return mapFailure(c, updated.error);
  }

  const reply = presentTodo(updated.value);
  return success(c, reply);
};
