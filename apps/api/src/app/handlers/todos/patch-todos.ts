import { PatchTodosBody } from "@todo/contract-api";
import type { Context } from "hono";
import type { SetAllCompleted } from "@todo/operations/todos/set-all-completed.ts";
import type { toCompleted } from "@todo/valid/todos/completed.ts";
import { invalidOf } from "../messages.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateBody } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** The validator construct gives this handler (L33). */
type ToCompleted = typeof toCompleted;

/** `PATCH /todos`: validate the body, read `completed`, set it on every todo, then present the list. */
export const patchTodos = (setAllCompleted: SetAllCompleted, toCompleted: ToCompleted) => async (c: Context) => {
  // The body must be JSON, shaped as the contract says.
  const body = await validateBody(c, PatchTodosBody);
  if (!body.ok) {
    return userFailure(c, body.error);
  }

  // completed must be true or false.
  const completed = toCompleted({ completed: body.value.completed });
  if (!completed.ok) {
    return userFailure(c, invalidOf(completed.error));
  }

  // No business rule refuses it, but the store can fail.
  const set = await setAllCompleted(completed.value);
  if (!set.ok) {
    return mapFailure(c, set.error);
  }

  const reply = set.value.map(presentTodo);
  return success(c, reply);
};
