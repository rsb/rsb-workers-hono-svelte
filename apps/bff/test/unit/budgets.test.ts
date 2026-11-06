import { describe, expect, it } from "vitest";
import type { Filter } from "../../src/lib/filter.ts";
import { loadFrame } from "../../src/lib/server/session/frame.ts";
import { addTodo } from "../../src/lib/server/todos/add-todo.ts";
import { clearCompletedTodos } from "../../src/lib/server/todos/clear-completed-todos.ts";
import { editTodo } from "../../src/lib/server/todos/edit-todo.ts";
import { loadTodos } from "../../src/lib/server/todos/load-todos.ts";
import { markAllTodos } from "../../src/lib/server/todos/mark-all-todos.ts";
import { removeTodo } from "../../src/lib/server/todos/remove-todo.ts";
import { toggleTodo } from "../../src/lib/server/todos/toggle-todo.ts";
// Types only: the budgets need the actions' names, not the route module.
import type * as page from "../../src/routes/[[filter=filter]]/+page.server.ts";

type Api = Pick<Fetcher, "fetch">;

const todo = { id: "id-1", title: "buy milk", completed: false };
const user = { id: "u1", role: "member", emailVerified: true, name: "Dev Member", email: "member@example.test" };

/** The reply the API gives a successful request, by method and path. */
const reply = (method: string, path: string): unknown => {
  if (method === "GET" && path === "/sessions/current") {
    return { user, clearCookie: false };
  }
  if (method === "GET" && path === "/todos/counts") {
    return { active: 1, completed: 0 };
  }
  if (method === "POST" || (method === "PATCH" && path.startsWith("/todos/"))) {
    return todo;
  }
  if (method === "DELETE" && path.startsWith("/todos/")) {
    return { id: todo.id };
  }
  return [todo];
};

/**
 * A fake `API` binding that answers every request as a success, and
 * records each one as `METHOD /path`: one entry is one round trip to the api.
 */
const countingApi = () => {
  const calls: string[] = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const path = url.replace("https://todo-api", "");
    calls.push(`${method} ${path}`);
    return Response.json({ ok: true, data: reply(method, path) });
  };
  return { api: { fetch } as Api, calls };
};

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
};

/** A unit's budget of api calls, and the call that spends it. */
type Budget = { apiCalls: number; run: (api: Api) => Promise<unknown> };

/**
 * Each page load's and each form action's budget of calls to the api,
 * through the `API` binding (L11, L36): the current cost written down, not
 * a limit to stay under. A filter or an action without one does not
 * compile. The reload SvelteKit runs after an action counts against the
 * load, not the action (Q4). A change to a number goes in the commit that
 * changes the cost, with its reason.
 */
/**
 * A page load: the root layout's and the page's, which SvelteKit runs side
 * by side. Every page but the probe spends the frame's actor read, 1 call
 * (`feature-accounts-shell.md`, Budget).
 */
const pageLoad = (api: Api, filter: Filter) => {
  const cookies = { delete: () => {} };
  return Promise.all([loadFrame(api, "/[[filter=filter]]", cookies, "sid"), loadTodos(api, filter)]);
};

const loads: Record<Filter, Budget> = {
  // The actor, and the list; the counts are derived from it (deviation 5).
  all: { apiCalls: 2, run: (api) => pageLoad(api, "all") },
  // The actor, and the filtered list and the counts (deviation 5).
  active: { apiCalls: 3, run: (api) => pageLoad(api, "active") },
  completed: { apiCalls: 3, run: (api) => pageLoad(api, "completed") },
};

const actions: Record<keyof typeof page.actions, Budget> = {
  add: { apiCalls: 1, run: (api) => addTodo(api, form({ title: "buy milk" })) },
  toggle: { apiCalls: 1, run: (api) => toggleTodo(api, form({ id: "id-1", completed: "true" })) },
  edit: { apiCalls: 1, run: (api) => editTodo(api, form({ id: "id-1", title: "buy bread" })) },
  markAll: { apiCalls: 1, run: (api) => markAllTodos(api, form({ completed: "true" })) },
  remove: { apiCalls: 1, run: (api) => removeTodo(api, form({ id: "id-1" })) },
  clearCompleted: { apiCalls: 1, run: (api) => clearCompletedTodos(api) },
};

const spends = async (unit: string, { apiCalls, run }: Budget) => {
  const { api, calls } = countingApi();

  const result = await run(api);

  // A failed load or action can stop short of its cost, so only a success
  // counts. A failed page read throws, a failed actor read is `failed`, and
  // a failed action has a status.
  expect(result, `${unit} failed, so its cost was not measured`).not.toHaveProperty("status");
  expect(JSON.stringify(result), `${unit} failed, so its cost was not measured`).not.toContain('"state":"failed"');
  const words = `${unit}: budget ${apiCalls} api calls, spent ${calls.length} (${calls.join(", ")})`;
  expect(calls.length, words).toBe(apiCalls);
};

describe("each page load spends its budget of api calls", () => {
  it.each(Object.entries(loads))("load %s", (filter, budget) => spends(`load ${filter}`, budget));
});

describe("each form action spends its budget of api calls", () => {
  it.each(Object.entries(actions))("action %s", (action, budget) => spends(`action ${action}`, budget));
});
