import type { Context } from "hono";
import type { ListTodos } from "../../operations/todos/list-todos.ts";
import { success } from "../present.ts";
import { presentTodo } from "./present.ts";

/** `GET /todos`: nothing to validate, and listing cannot fail. */
export const getTodos = (listTodos: ListTodos) => (c: Context) =>
  success(c, listTodos().map(presentTodo));
