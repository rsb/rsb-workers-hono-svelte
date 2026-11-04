import { AddTodoBody } from "@todo/contract-api";
import type { Context } from "hono";
import type { AddTodo } from "@todo/operations/todos/add-todo.ts";
import type { toNewTodo } from "@todo/valid/todos/new-todo.ts";
import { invalidOf } from "../messages.ts";
import { created, mapFailure, userFailure } from "../present.ts";
import { validateBody } from "../validate.ts";
import { presentTodo } from "./present.ts";

/** The validator construct gives this handler (L33). */
type ToNewTodo = typeof toNewTodo;

/** `POST /todos`: validate the body, make it a new todo, add, then present. */
export const postTodos = (addTodo: AddTodo, toNewTodo: ToNewTodo) => async (c: Context) => {
  // The body must be JSON, shaped as the contract says.
  const body = await validateBody(c, AddTodoBody);
  if (!body.ok) {
    return userFailure(c, body.error);
  }

  // The title must follow the business rules.
  const newTodo = toNewTodo({ title: body.value.title });
  if (!newTodo.ok) {
    return userFailure(c, invalidOf(newTodo.error));
  }

  // Adding can fail for the user (the list is full) or for us (the store).
  const added = await addTodo(newTodo.value);
  if (!added.ok) {
    return mapFailure(c, added.error);
  }

  const reply = presentTodo(added.value);
  return created(c, reply);
};
