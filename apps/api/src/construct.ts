import { type DbStore, createDbStore } from "@todo/data-d1/store.ts";
import { type AddTodo, addTodo } from "@todo/operations/todos/add-todo.ts";
import { type CountTodos, countTodos } from "@todo/operations/todos/count-todos.ts";
import { type DeleteCompleted, deleteCompleted } from "@todo/operations/todos/delete-completed.ts";
import { type DeleteTodo, deleteTodo } from "@todo/operations/todos/delete-todo.ts";
import { type ListTodos, listTodos } from "@todo/operations/todos/list-todos.ts";
import { type SetAllCompleted, setAllCompleted } from "@todo/operations/todos/set-all-completed.ts";
import { type UpdateTodo, updateTodo } from "@todo/operations/todos/update-todo.ts";
import { toCompleted } from "@todo/valid/todos/completed.ts";
import { toNewTodo } from "@todo/valid/todos/new-todo.ts";
import { toTodoFilter } from "@todo/valid/todos/todo-filter.ts";
import { toTodoPatch } from "@todo/valid/todos/todo-patch.ts";
import { notFound, onError, tooLarge } from "./app/handlers/errors/errors.ts";
import { getHealth } from "./app/handlers/health/health.ts";
import { deleteTodo as deleteTodoHandler } from "./app/handlers/todos/delete-todo.ts";
import { deleteTodos } from "./app/handlers/todos/delete-todos.ts";
import { getTodoCounts } from "./app/handlers/todos/get-todo-counts.ts";
import { getTodos } from "./app/handlers/todos/get-todos.ts";
import { patchTodo } from "./app/handlers/todos/patch-todo.ts";
import { patchTodos } from "./app/handlers/todos/patch-todos.ts";
import { postTodos } from "./app/handlers/todos/post-todos.ts";
import type { Api, Routes } from "./http.ts";
import { routing } from "./route.ts";

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
  countTodos: CountTodos;
  updateTodo: UpdateTodo;
  setAllCompleted: SetAllCompleted;
  deleteTodo: DeleteTodo;
  deleteCompleted: DeleteCompleted;
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
  countTodos: countTodos({ dbStore: infra.dbStore }),
  updateTodo: updateTodo({ dbStore: infra.dbStore }),
  setAllCompleted: setAllCompleted({ dbStore: infra.dbStore }),
  deleteTodo: deleteTodo({ dbStore: infra.dbStore }),
  deleteCompleted: deleteCompleted({ dbStore: infra.dbStore }),
});

/** The route helpers, bound to these operations. */
const { route, probe } = routing<Operations>();

/**
 * Each handler with the unit it runs and the validator it is given, keyed
 * by its endpoint as the spec writes it. Every endpoint has exactly one
 * route, or this does not compile. Routes are registered in this order, so
 * a fixed path comes before `/todos/{id}` and `counts` is never read as an
 * id.
 */
export const constructRoutes = (operations: Operations): Routes => {
  // The built operations, named as the units they are. Inside this function
  // they hide the builders of the same name imported above.
  const { addTodo, listTodos, countTodos, updateTodo, setAllCompleted, deleteTodo, deleteCompleted } = operations;

  return {
    "GET /health": probe({ getHealth }),
    "GET /todos": route({ getTodos }, { listTodos }, { toTodoFilter }),
    "GET /todos/counts": route({ getTodoCounts }, { countTodos }),
    "POST /todos": route({ postTodos }, { addTodo }, { toNewTodo }),
    "PATCH /todos": route({ patchTodos }, { setAllCompleted }, { toCompleted }),
    "PATCH /todos/{id}": route({ patchTodo }, { updateTodo }, { toTodoPatch }),
    "DELETE /todos": route({ deleteTodos }, { deleteCompleted }),
    "DELETE /todos/{id}": route({ deleteTodo: deleteTodoHandler }, { deleteTodo }),
  };
};

/** The routes plus the failure handlers, typed by `http.ts`. */
export const constructApi = (routes: Routes): Api => ({
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
