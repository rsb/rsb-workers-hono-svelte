// What the route helpers and the route table refuse to compile (P54, P55,
// L33). This file is not run: `pnpm check` compiles it with `tsc`, and each
// `@ts-expect-error` fails the check when the line below it compiles. So a
// helper that loosens fails here, and each refusal is beside an accepted
// call, so a helper that refuses everything fails too.

import type { AddTodo } from "@todo/operations/todos/add-todo.ts";
import { toNewTodo } from "@todo/valid/todos/new-todo.ts";
import { toTodoPatch } from "@todo/valid/todos/todo-patch.ts";
import type { Context } from "hono";
import { getHealth } from "../../src/app/handlers/health/health.ts";
import { getTodoCounts } from "../../src/app/handlers/todos/get-todo-counts.ts";
import { postTodos } from "../../src/app/handlers/todos/post-todos.ts";
import type { Operations } from "../../src/construct.ts";
import type { Route, Routes } from "../../src/http.ts";
import { routing } from "../../src/route.ts";

declare const operations: Operations;
const { addTodo, countTodos, listTodos } = operations;
const { route, probe } = routing<Operations>();

// Accepted: a handler with its unit, with its validator when it takes one.
route({ postTodos }, { addTodo }, { toNewTodo });
route({ getTodoCounts }, { countTodos });
probe({ getHealth });

// 1. A handler that takes a validator is not built without one.
// @ts-expect-error
route({ postTodos }, { addTodo });

// 2. Nor with another validator than the one it takes.
// @ts-expect-error
route({ postTodos }, { addTodo }, { toTodoPatch });

// 3. A handler that takes none is not given one.
// @ts-expect-error
route({ getTodoCounts }, { countTodos }, { toNewTodo });

// 4. The wrong unit, with the right validator.
// @ts-expect-error
route({ postTodos }, { listTodos }, { toNewTodo });

// 5. The handler takes exactly one operation's type (`Runs`): not a unit no
// operation has, nor one another operation shares.
const takesANumber = (unit: (n: number) => Promise<number>) => (c: Context) => c.text(String(unit));
// @ts-expect-error
route({ takesANumber }, { addTodo });

declare const twins: { first: AddTodo; second: AddTodo };
const twinned = routing<typeof twins>();
const { first } = twins;
// @ts-expect-error
twinned.route({ postTodos }, { first }, { toNewTodo });

const single = routing<{ first: AddTodo }>();
single.route({ postTodos }, { first }, { toNewTodo });

// 6. The table has a route for every endpoint, and none the contract lacks.
declare const any: Route;

export const every: Routes = {
  "GET /health": any,
  "GET /todos": any,
  "GET /todos/counts": any,
  "POST /todos": any,
  "PATCH /todos": any,
  "PATCH /todos/{id}": any,
  "DELETE /todos": any,
  "DELETE /todos/{id}": any,
};

// @ts-expect-error
export const missing: Routes = {
  "GET /health": any,
  "GET /todos": any,
  "GET /todos/counts": any,
  "POST /todos": any,
  "PATCH /todos": any,
  "PATCH /todos/{id}": any,
  "DELETE /todos": any,
};

export const extra: Routes = {
  "GET /health": any,
  "GET /todos": any,
  "GET /todos/counts": any,
  "POST /todos": any,
  "PATCH /todos": any,
  "PATCH /todos/{id}": any,
  "DELETE /todos": any,
  "DELETE /todos/{id}": any,
  // @ts-expect-error
  "GET /todos/{id}": any,
};
