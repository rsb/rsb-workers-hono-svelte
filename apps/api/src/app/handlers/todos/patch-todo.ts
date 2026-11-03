import { ToggleTodoBody } from "@todo/contract-api";
import type { Context, Env } from "hono";
import type { ToggleTodo } from "@todo/operations/todos/toggle-todo.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateBody } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** `PATCH /todos/:id`: validate the body, toggle, then present. */
export const patchTodo = (toggleTodo: ToggleTodo) => async (c: Context<Env, "/todos/:id">) => {
  // Any id is asked for as it is; one no todo has is not found.
  const id = c.req.param("id");

  // The body must be JSON, shaped as the contract says.
  const body = await validateBody(c, ToggleTodoBody);
  if (!body.ok) {
    return userFailure(c, body.error);
  }

  // Toggling can fail for the user (no such todo) or for us (the store).
  const toggled = await toggleTodo(id, body.value.completed);
  if (!toggled.ok) {
    return mapFailure(c, toggled.error);
  }

  const reply = presentTodo(toggled.value);
  return success(c, reply);
};
