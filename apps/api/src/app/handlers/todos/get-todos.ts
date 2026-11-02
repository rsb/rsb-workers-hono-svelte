import type { Context } from "hono";
import type { ListTodos } from "@todo/operations/todos/list-todos.ts";
import { mapFailure, success } from "../present.ts";
import { presentTodo } from "./present.ts";

/** `GET /todos`: nothing to validate; list, then present. */
export const getTodos = (listTodos: ListTodos) => async (c: Context) => {
  // No business rule refuses a list, but the store can fail.
  const listed = await listTodos();
  if (!listed.ok) {
    return mapFailure(c, listed.error);
  }

  const reply = listed.value.map(presentTodo);
  return success(c, reply);
};
