import { d1Todos } from "@todo/data-d1/todos.ts";
import { type AddStore, type AddTodo, addTodo } from "@todo/operations/todos/add-todo.ts";
import { type ListStore, type ListTodos, listTodos } from "@todo/operations/todos/list-todos.ts";
import { notFound, onError, tooLarge } from "./app/handlers/errors/errors.ts";
import { getHealth } from "./app/handlers/health/health.ts";
import { getTodos } from "./app/handlers/todos/get-todos.ts";
import { postTodos } from "./app/handlers/todos/post-todos.ts";
import type { Config } from "./config.ts";
import type { Api, Route } from "./http.ts";

// The app's whole dependency graph, one builder per level (A10). Each level
// takes the one below, so a caller can enter at any level and replace a piece.

/** The concrete world: the store and the id source. */
export type Infra = { store: AddStore & ListStore; newId: () => string };

/** Every operation, each built with the ports it declares. */
export type Operations = { addTodo: AddTodo; listTodos: ListTodos };

/**
 * The only builder that sees config: it copies each value into what needs it.
 * The running Worker always stores todos in D1 (DB4).
 */
export const constructInfra = (config: Config): Infra => ({
  store: d1Todos(config.db),
  newId: () => crypto.randomUUID(),
});

/** The same store goes to both operations, so an add is seen by the next list (D15). */
export const constructOperations = (infra: Infra): Operations => ({
  addTodo: addTodo({ store: infra.store, newId: infra.newId }),
  listTodos: listTodos({ store: infra.store }),
});

/** Each handler with the operation it runs, laid out as routes. */
export const constructRoutes = (operations: Operations): Route[] => [
  { method: "GET", path: "/health", handler: getHealth },
  { method: "GET", path: "/todos", handler: getTodos(operations.listTodos) },
  { method: "POST", path: "/todos", handler: postTodos(operations.addTodo) },
];

/** The routes plus the failure handlers, typed by `http.ts`. */
export const constructApi = (routes: readonly Route[]): Api => ({
  routes,
  notFound,
  tooLarge,
  onError,
});

/** The default chain, which `index.ts` calls. */
export const construct = (config: Config, overrides?: Partial<Infra>): Api =>
  constructApi(constructRoutes(constructOperations({ ...constructInfra(config), ...overrides })));
