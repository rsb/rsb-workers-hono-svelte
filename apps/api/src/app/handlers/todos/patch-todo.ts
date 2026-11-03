import { PatchTodoBody } from "@todo/contract-api";
import type { Context, Env } from "hono";
import type { TodoPatch } from "@todo/business/todos/todo.ts";
import type { UpdateTodo } from "@todo/operations/todos/update-todo.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateBody } from "../validate.ts";
import { presentTodo } from "./present.ts";
import { validateTitle } from "./validate.ts";

/** `PATCH /todos/:id`: validate the body, validate a title if there is one, update, then present. */
export const patchTodo = (updateTodo: UpdateTodo) => async (c: Context<Env, "/todos/:id">) => {
  // Any id is asked for as it is; one no todo has is not found.
  const id = c.req.param("id");

  // The body must be JSON, shaped as the contract says.
  const body = await validateBody(c, PatchTodoBody);
  if (!body.ok) {
    return userFailure(c, body.error);
  }

  const patch: TodoPatch = {};
  if (body.value.completed !== undefined) {
    patch.completed = body.value.completed;
  }

  // A title, when there is one, must follow the business rules.
  if (body.value.title !== undefined) {
    const title = validateTitle({ title: body.value.title });
    if (!title.ok) {
      return userFailure(c, title.error);
    }
    patch.title = title.value.title;
  }

  // Updating can fail for the user (no such todo) or for us (the store).
  const updated = await updateTodo(id, patch);
  if (!updated.ok) {
    return mapFailure(c, updated.error);
  }

  const reply = presentTodo(updated.value);
  return success(c, reply);
};
