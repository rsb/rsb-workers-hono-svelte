import { memoryTodos } from "./app/data/memory/todos.ts";
import { notFound, onError, tooLarge } from "./app/handlers/errors/errors.ts";
import { getHealth } from "./app/handlers/health/health.ts";
import { getTodos } from "./app/handlers/todos/get-todos.ts";
import { postTodos } from "./app/handlers/todos/post-todos.ts";
import { addTodo } from "./app/operations/todos/add-todo.ts";
import { listTodos } from "./app/operations/todos/list-todos.ts";
import type { Api } from "./http.ts";

/** Builds every object once, injects each one's dependencies, and lays out the routes. */
export const construct = (): Api => {
  const store = memoryTodos();
  const newId = () => crypto.randomUUID();

  return {
    routes: [
      { method: "GET", path: "/health", handler: getHealth },
      { method: "GET", path: "/todos", handler: getTodos(listTodos({ store })) },
      { method: "POST", path: "/todos", handler: postTodos(addTodo({ store, newId })) },
    ],
    notFound,
    tooLarge,
    onError,
  };
};
