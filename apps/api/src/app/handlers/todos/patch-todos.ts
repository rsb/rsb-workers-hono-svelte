import { PatchTodosBody } from "@todo/contract-api";
import type { Context } from "hono";
import type { SetAllCompleted } from "@todo/operations/todos/set-all-completed.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateBody } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** `PATCH /todos`: validate the body, set `completed` on every todo, then present the list. */
export const patchTodos = (setAllCompleted: SetAllCompleted) => async (c: Context) => {
  // The body must be JSON, shaped as the contract says.
  const body = await validateBody(c, PatchTodosBody);
  if (!body.ok) {
    return userFailure(c, body.error);
  }

  // No business rule refuses it, but the store can fail.
  const set = await setAllCompleted(body.value.completed);
  if (!set.ok) {
    return mapFailure(c, set.error);
  }

  const reply = set.value.map(presentTodo);
  return success(c, reply);
};
