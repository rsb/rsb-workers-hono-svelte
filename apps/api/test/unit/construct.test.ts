import { Failure, TodoListReply, TodoReply, envelope } from "@todo/contract-api";
import { ok } from "@todo/business/result.ts";
import { TODO_LIMIT, type Todo } from "@todo/business/todos/todo.ts";
import type { DbStore } from "@todo/data-d1/store.ts";
import * as v from "valibot";
import { expect, it } from "vitest";
import { constructApi, constructOperations, constructRoutes } from "../../src/construct.ts";
import { serve } from "../../src/http.ts";

/**
 * A fake `DbStore` that keeps todos in an array. It reports facts as the
 * real one does: whether a todo was inserted, every todo in order, and a
 * todo as it is after a patch is applied.
 */
const fakeDbStore = (): DbStore => {
  const todos: Todo[] = [];
  return {
    addTodoUnlessFull: async (todo, limit) => {
      if (todos.length >= limit) {
        return ok(false);
      }
      todos.push(todo);
      return ok(true);
    },
    listTodos: async () => {
      return ok([...todos]);
    },
    updateTodo: async (id, patch) => {
      const index = todos.findIndex((todo) => todo.id === id);
      const found = todos[index];
      if (found === undefined) {
        return ok(null);
      }
      const updated = { ...found, ...patch };
      todos[index] = updated;
      return ok(updated);
    },
  };
};

// The whole route table on a fake store, entered below `constructInfra`
// (A10): no workerd, no database, and a fixed id so the reply is exact.
const app = (newId = () => "id-1") => {
  const operations = constructOperations({ dbStore: fakeDbStore(), newId });
  const routes = constructRoutes(operations);
  return serve(constructApi(routes));
};

it("an added todo is in the next list", async () => {
  const api = app();

  const added = await api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  expect(added.status).toBe(201);
  expect(v.parse(envelope(TodoReply), await added.json())).toEqual({
    ok: true,
    data: { id: "id-1", title: "buy milk", completed: false },
  });

  const listed = await api.request("/todos");
  expect(v.parse(envelope(TodoListReply), await listed.json())).toEqual({
    ok: true,
    data: [{ id: "id-1", title: "buy milk", completed: false }],
  });
});

it("an add after the limit is refused with limit", async () => {
  let n = 0;
  const api = app(() => `id-${++n}`);
  const add = () => api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  for (let i = 1; i <= TODO_LIMIT; i++) {
    expect((await add()).status).toBe(201);
  }

  const refused = await add();

  expect(refused.status).toBe(409);
  expect(v.parse(Failure, await refused.json()).error.kind).toBe("limit");
});

it("a toggled todo is completed in the next list, and can be made active again", async () => {
  const api = app();
  await api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  const toggle = (completed: boolean) =>
    api.request("/todos/id-1", { method: "PATCH", body: JSON.stringify({ completed }) });

  const completed = await toggle(true);
  expect(completed.status).toBe(200);
  expect(v.parse(envelope(TodoReply), await completed.json())).toEqual({
    ok: true,
    data: { id: "id-1", title: "buy milk", completed: true },
  });
  const listed = await api.request("/todos");
  expect(v.parse(envelope(TodoListReply), await listed.json())).toEqual({
    ok: true,
    data: [{ id: "id-1", title: "buy milk", completed: true }],
  });

  const active = await toggle(false);
  expect(v.parse(envelope(TodoReply), await active.json())).toMatchObject({ data: { completed: false } });
});

it("a toggle of an id no todo has is refused with not_found", async () => {
  const api = app();

  const refused = await api.request("/todos/id-9", { method: "PATCH", body: '{"completed":true}' });

  expect(refused.status).toBe(404);
  expect(v.parse(Failure, await refused.json()).error.kind).toBe("not_found");
});
