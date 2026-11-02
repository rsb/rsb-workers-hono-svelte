import { AddTodoBody } from "@todo/contract-api";
import type { Context } from "hono";
import type { AddTodo } from "@todo/operations/todos/add-todo.ts";
import { created, mapFailure, userFailure } from "../present.ts";
import { validateBody } from "../validate.ts";
import { presentTodo } from "./present.ts";
import { validateTitle } from "./validate.ts";

/** `POST /todos`: validate the body, validate the title, add, then present. */
export const postTodos = (addTodo: AddTodo) => async (c: Context) => {
  // The body must be JSON, shaped as the contract says.
  const body = await validateBody(c, AddTodoBody);
  if (!body.ok) {
    return userFailure(c, body.error);
  }

  // The title must follow the business rules.
  const newTodo = validateTitle(body.value);
  if (!newTodo.ok) {
    return userFailure(c, newTodo.error);
  }

  // Adding can fail for the user (the list is full) or for us (the store).
  const added = await addTodo(newTodo.value);
  if (!added.ok) {
    return mapFailure(c, added.error);
  }

  const reply = presentTodo(added.value);
  return created(c, reply);
};
