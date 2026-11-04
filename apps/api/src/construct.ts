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
import type { Context } from "hono";
import { notFound, onError, tooLarge } from "./app/handlers/errors/errors.ts";
import { getHealth } from "./app/handlers/health/health.ts";
import { deleteTodo as deleteTodoHandler } from "./app/handlers/todos/delete-todo.ts";
import { deleteTodos } from "./app/handlers/todos/delete-todos.ts";
import { getTodoCounts } from "./app/handlers/todos/get-todo-counts.ts";
import { getTodos } from "./app/handlers/todos/get-todos.ts";
import { patchTodo } from "./app/handlers/todos/patch-todo.ts";
import { patchTodos } from "./app/handlers/todos/patch-todos.ts";
import { postTodos } from "./app/handlers/todos/post-todos.ts";
import type { Api, Route, Routes, Validator } from "./http.ts";

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

/** The one entry of `{ name: value }`, so that a name is read from its identifier. */
const named = <T>(single: Record<string, T>, what: string): [string, T] => {
  const entries = Object.entries(single);
  const [entry] = entries;
  if (entries.length !== 1 || entry === undefined) {
    throw new Error(`construct: ${what} must be one name, given ${entries.length}`);
  }
  return entry;
};

/** `true` when `A` and `B` are the same type, not only assignable one way. */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** The operations whose type is exactly `U`. */
type UnitsTyped<U> = {
  [P in keyof Operations]: Same<Operations[P], U> extends true ? P : never;
}[keyof Operations];

/**
 * Nothing when a handler that takes `U` may run the unit `K`; otherwise a
 * property no argument has, so the call does not compile. The handler must
 * take exactly the unit's type, and no other operation may have that type:
 * a unit that takes fewer arguments than the handler's, or none, or several
 * units, do not compile.
 */
type Runs<K extends keyof Operations, U> = Same<UnitsTyped<U>, K> extends true
  ? unknown
  : { "the handler does not take exactly this unit's type, or another operation has the same type": K };

/** What a handler is given and gives: its unit, then its validator if it takes one. */
type Builds = (unit: never, validator: never) => Route["handler"];

/**
 * A route whose handler runs one unit (L19), and builds its input with one
 * validator when it takes one (L33). Each is given as `{ name }`, so the
 * route carries their names as data and the handler is built here:
 * `route({ postTodos }, { addTodo }, { toNewTodo })` is
 * `postTodos(addTodo, toNewTodo)`, named `postTodos`, running `addTodo` and
 * applying what `toNewTodo` applies. The unit must be one of `Operations`,
 * and the handler must take exactly its type (`Runs`). The validator is the
 * one the handler is given, so what the route says it applies is what runs:
 * a handler that takes a validator is not built without one, and one that
 * takes none is not given one. That the names are the values' own is
 * checked by `pnpm check:entry-chains`, which reads this file.
 */
function route<K extends keyof Operations, U>(
  handler: Record<string, (unit: U) => Route["handler"]>,
  unit: Pick<Operations, K> & Runs<K, U>,
): Route;
function route<K extends keyof Operations, H extends Builds>(
  handler: Record<string, H>,
  unit: Pick<Operations, K> & Runs<K, Parameters<H>[0]>,
  validator: Record<string, Parameters<H>[1] & Validator>,
): Route;
function route(
  handler: Record<string, Builds>,
  unit: Record<string, unknown>,
  validator?: Record<string, Validator>,
): Route {
  const [name, build] = named(handler, "a route's handler");
  const [unitName, built] = named(unit, "a route's unit");
  if (validator === undefined) {
    return { name, unit: unitName, validator: null, handler: build(built as never, undefined as never) };
  }
  const [validatorName, value] = named(validator, "a route's validator");
  return {
    name,
    unit: unitName,
    validator: { name: validatorName, value },
    handler: build(built as never, value as never),
  };
}

/** A probe's route: its entry point takes the request and runs no unit (L20). `probe({ getHealth })`. */
const probe = (handler: Record<string, (c: Context) => Response | Promise<Response>>): Route => {
  const [name, built] = named(handler, "a probe");
  return { name, unit: null, validator: null, handler: built };
};

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
