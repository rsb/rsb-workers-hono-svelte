import { access } from "@todo/business/access.ts";
import { type IdentityStore, createIdentityStore } from "@todo/data-d1/identity/store.ts";
import { type DbStore, createDbStore } from "@todo/data-d1/store.ts";
import { authenticate as authenticateUnit } from "@todo/gates/authenticate.ts";
import { type CurrentSession, currentSession } from "@todo/operations/auth/current-session.ts";
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
import type { Hasher } from "@todo/operations/auth/sign-in.ts";
import { notFound, onError, tooLarge } from "./app/handlers/errors/errors.ts";
import { getHealth } from "./app/handlers/health/health.ts";
import { getCurrentSession } from "./app/handlers/sessions/get-current-session.ts";
import { deleteTodo as deleteTodoHandler } from "./app/handlers/todos/delete-todo.ts";
import { deleteTodos } from "./app/handlers/todos/delete-todos.ts";
import { getTodoCounts } from "./app/handlers/todos/get-todo-counts.ts";
import { getTodos } from "./app/handlers/todos/get-todos.ts";
import { patchTodo } from "./app/handlers/todos/patch-todo.ts";
import { patchTodos } from "./app/handlers/todos/patch-todos.ts";
import { postTodos } from "./app/handlers/todos/post-todos.ts";
import { argon2FromWasm, createHasher } from "./auth/hasher.ts";
import type { Config } from "./config.ts";
import { authenticate } from "./gates/authenticate.ts";
import { bodyLimit } from "./gates/body-limit.ts";
import { channel } from "./gates/channel.ts";
import { sha256Hex } from "./gates/digest.ts";
import { requestId } from "./gates/request-id.ts";
import type { Api, Gates, Routes } from "./http.ts";
import { routing } from "./route.ts";

// The app's whole dependency graph, one builder per level (A10). Each level
// takes the one below, so a caller can enter at any level and replace a piece.

/**
 * What the platform hands over already configured and built: not config.
 * `argon2Wasm` is Argon2's `.wasm`, which the Worker imports as a module and
 * the platform compiles (L48).
 */
export type Bindings = { appDb: D1Database; identityDb: D1Database; argon2Wasm: WebAssembly.Module };

/**
 * The concrete world: a store per database (L42), the id source, the clock,
 * the hash a session token is kept under, and the hasher a password is
 * checked with (L48).
 */
export type Infra = {
  dbStore: DbStore;
  identityStore: IdentityStore;
  newId: () => string;
  now: () => number;
  digest: (token: string) => Promise<string>;
  hasher: Hasher;
};

/**
 * Every operation, each built with the ports it declares. Each has one row
 * in `prd/todo/access.md`, which its builder applies (`check:access`).
 */
export type Operations = {
  addTodo: AddTodo;
  listTodos: ListTodos;
  countTodos: CountTodos;
  updateTodo: UpdateTodo;
  setAllCompleted: SetAllCompleted;
  deleteTodo: DeleteTodo;
  deleteCompleted: DeleteCompleted;
  currentSession: CurrentSession;
};

/**
 * The only builder that sees the bindings: it passes each to what uses it.
 * The running Worker always stores todos in D1 (DB4). It takes the config
 * for the peppers, which the hasher keys a password with. Argon2 is
 * instantiated on the first sign-in, not at startup.
 */
export const constructInfra = (bindings: Bindings, config: Config): Infra => ({
  dbStore: createDbStore(bindings.appDb),
  identityStore: createIdentityStore(bindings.identityDb),
  newId: () => crypto.randomUUID(),
  now: () => Date.now(),
  digest: sha256Hex,
  hasher: createHasher({
    argon2: argon2FromWasm(bindings.argon2Wasm),
    peppers: config.peppers,
  }),
});

/**
 * The gates, in the order they run on every request, before routing (L38):
 * each is listed once, here. Only `authenticate` has a unit; it gets the
 * identity store as its lookup, and the binding gets it to touch with.
 */
export const constructGates = (infra: Infra, config: Config): Gates => [
  requestId,
  bodyLimit(tooLarge),
  channel({ bffOrigin: config.bffOrigin, sessionCookie: config.sessionCookie }),
  authenticate({
    unit: authenticateUnit({ sessions: infra.identityStore, digest: infra.digest }),
    sessions: infra.identityStore,
    now: infra.now,
    sessionCookie: config.sessionCookie,
  }),
];

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
  currentSession: currentSession(),
});

/** The route helpers, bound to these operations and their rows in `access.md`. */
const { route, probe } = routing<Operations>(access);

/**
 * Each handler with the unit it runs and the validator it is given, keyed
 * by its endpoint as the spec writes it. Every endpoint has exactly one
 * route, or this does not compile. Routes are registered in this order, so
 * a fixed path comes before `/todos/{id}` and `counts` is never read as an
 * id. Each handler runs behind its unit's row (`route.ts`).
 */
export const constructRoutes = (operations: Operations): Routes => {
  // The built operations, named as the units they are. Inside this function
  // they hide the builders of the same name imported above.
  const { addTodo, listTodos, countTodos, updateTodo, setAllCompleted, deleteTodo, deleteCompleted, currentSession } = operations;

  return {
    "GET /health": probe({ getHealth }),
    "GET /sessions/current": route({ getCurrentSession }, { currentSession }),
    "GET /todos": route({ getTodos }, { listTodos }, { toTodoFilter }),
    "GET /todos/counts": route({ getTodoCounts }, { countTodos }),
    "POST /todos": route({ postTodos }, { addTodo }, { toNewTodo }),
    "PATCH /todos": route({ patchTodos }, { setAllCompleted }, { toCompleted }),
    "PATCH /todos/{id}": route({ patchTodo }, { updateTodo }, { toTodoPatch }),
    "DELETE /todos": route({ deleteTodos }, { deleteCompleted }),
    "DELETE /todos/{id}": route({ deleteTodo: deleteTodoHandler }, { deleteTodo }),
  };
};

/** The gates, the routes and the failure handlers, typed by `http.ts`. */
export const constructApi = (gates: Gates, routes: Routes): Api => ({
  gates,
  routes,
  notFound,
  onError,
});

/** Builds the whole app from the bindings and the config, one A10 level at a time. `index.ts` calls this. */
export const construct = (bindings: Bindings, config: Config): Api => {
  const infra = constructInfra(bindings, config);
  const gates = constructGates(infra, config);
  const operations = constructOperations(infra);
  const routes = constructRoutes(operations);
  return constructApi(gates, routes);
};
