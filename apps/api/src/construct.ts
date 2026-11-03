import { type DbStore, createDbStore } from "@todo/data-d1/store.ts";
import { type AddTodo, addTodo } from "@todo/operations/todos/add-todo.ts";
import { type DeleteTodo, deleteTodo } from "@todo/operations/todos/delete-todo.ts";
import { type ListTodos, listTodos } from "@todo/operations/todos/list-todos.ts";
import { type UpdateTodo, updateTodo } from "@todo/operations/todos/update-todo.ts";
import { notFound, onError, tooLarge } from "./app/handlers/errors/errors.ts";
import { getHealth } from "./app/handlers/health/health.ts";
import { deleteTodo as deleteTodoHandler } from "./app/handlers/todos/delete-todo.ts";
import { getTodos } from "./app/handlers/todos/get-todos.ts";
import { patchTodo } from "./app/handlers/todos/patch-todo.ts";
import { postTodos } from "./app/handlers/todos/post-todos.ts";
import type { Api, Route } from "./http.ts";

// The app's whole dependency graph, one builder per level (A10). Each level
// takes the one below, so a caller can enter at any level and replace a piece.

/** What the platform hands over already configured and built: not config. */
export type Bindings = { db: D1Database };

/** The concrete world: the database store and the id source. */
export type Infra = { dbStore: DbStore; newId: () => string };

/** Every operation, each built with the ports it declares. */
export type Operations = {
  addTodo: AddTodo;
  listTodos: ListTodos;
  updateTodo: UpdateTodo;
  deleteTodo: DeleteTodo;
};

/**
 * The only builder that sees the bindings: it passes each to what uses it.
 * The running Worker always stores todos in D1 (DB4).
 */
export const constructInfra = (bindings: Bindings): Infra => ({
  dbStore: createDbStore(bindings.db),
  newId: () => crypto.randomUUID(),
});

/**
 * Every operation gets the whole `DbStore`; each port lets it see only the
 * methods it declares. The same store goes to all, so an add is seen by the
 * next list (D15).
 */
export const constructOperations = (infra: Infra): Operations => ({
  addTodo: addTodo({ dbStore: infra.dbStore, newId: infra.newId }),
  listTodos: listTodos({ dbStore: infra.dbStore }),
  updateTodo: updateTodo({ dbStore: infra.dbStore }),
  deleteTodo: deleteTodo({ dbStore: infra.dbStore }),
});

/** Each handler with the operation it runs, laid out as routes. */
export const constructRoutes = (operations: Operations): Route[] => [
  { method: "GET", path: "/health", handler: getHealth },
  { method: "GET", path: "/todos", handler: getTodos(operations.listTodos) },
  { method: "POST", path: "/todos", handler: postTodos(operations.addTodo) },
  { method: "PATCH", path: "/todos/:id", handler: patchTodo(operations.updateTodo) },
  { method: "DELETE", path: "/todos/:id", handler: deleteTodoHandler(operations.deleteTodo) },
];

/** The routes plus the failure handlers, typed by `http.ts`. */
export const constructApi = (routes: readonly Route[]): Api => ({
  routes,
  notFound,
  tooLarge,
  onError,
});

/** Builds the whole app from the bindings, one A10 level at a time. `index.ts` calls this. */
export const construct = (bindings: Bindings): Api => {
  const infra = constructInfra(bindings);
  const operations = constructOperations(infra);
  const routes = constructRoutes(operations);
  return constructApi(routes);
};
