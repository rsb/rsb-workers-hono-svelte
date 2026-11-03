import { GetTodosQuery } from "@todo/contract-api";
import type { TodoFilter } from "@todo/business/todos/todo.ts";
import type { Context } from "hono";
import type { ListTodos } from "@todo/operations/todos/list-todos.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateQuery } from "../validate.ts";
import { presentTodo } from "./present.ts";

/**
 * The filter a valid query asks for. The query's value is text, so it is
 * turned into a boolean here, at the boundary. No `completed` keeps every todo.
 */
const toFilter = (query: GetTodosQuery): TodoFilter => {
  if (query.completed === "true") {
    return { completed: true };
  }
  if (query.completed === "false") {
    return { completed: false };
  }
  return {};
};

/** `GET /todos`, `?completed=true` or `?completed=false`: validate the query, list, then present. */
export const getTodos = (listTodos: ListTodos) => async (c: Context) => {
  const query = validateQuery(c, GetTodosQuery);
  if (!query.ok) {
    return userFailure(c, query.error);
  }

  const filter = toFilter(query.value);

  // No business rule refuses a list, but the store can fail.
  const listed = await listTodos(filter);
  if (!listed.ok) {
    return mapFailure(c, listed.error);
  }

  const reply = listed.value.map(presentTodo);
  return success(c, reply);
};
