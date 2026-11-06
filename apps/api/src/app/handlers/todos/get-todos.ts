import { GetTodosQuery } from "@todo/contract-api";
import type { Context } from "hono";
import type { ListTodos } from "@todo/operations/todos/list-todos.ts";
import type { toTodoFilter } from "@todo/valid/todos/todo-filter.ts";
import { invalidOf } from "../messages.ts";
import { mapFailure, success, userFailure } from "../present.ts";
import { validateQuery } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** The validator construct gives this handler (L33). */
type ToTodoFilter = typeof toTodoFilter;

/** `GET /todos`, `?completed=true` or `?completed=false`: validate the query, make it a filter, list, then present. */
export const getTodos = (listTodos: ListTodos, toTodoFilter: ToTodoFilter) => async (c: Context) => {
  // The query must be given once per key, shaped as the contract says.
  const query = validateQuery(c, GetTodosQuery);
  if (!query.ok) {
    return userFailure(c, query.error);
  }

  // The query's text becomes the filter's boolean. No `completed` keeps every todo.
  const filter = toTodoFilter({ completed: query.value.completed });
  if (!filter.ok) {
    return userFailure(c, invalidOf(filter.error));
  }

  // It runs as the actor the gate attached, so it lists their todos. The
  // runner refuses an anonymous one; the store can fail.
  const listed = await listTodos(c.get("actor"), filter.value);
  if (!listed.ok) {
    return mapFailure(c, listed.error);
  }

  const reply = listed.value.map(presentTodo);
  return success(c, reply);
};
