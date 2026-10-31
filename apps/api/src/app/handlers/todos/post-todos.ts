import { AddTodoBody } from "@todo/contract-api";
import type { Context } from "hono";
import type { AddTodo } from "@todo/operations/todos/add-todo.ts";
import { failure, success } from "../present.ts";
import { readJson } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** `POST /todos`: validate, operate, handle errors, present. */
export const postTodos = (addTodo: AddTodo) => async (c: Context) => {
  const input = await readJson(c, AddTodoBody);
  if (!input.ok) return failure(c, "validation", input.error.message, input.error.field);

  const added = await addTodo(input.value.title);
  if (!added.ok) return failure(c, "limit", "the list is full");

  return success(c, presentTodo(added.value), 201);
};
