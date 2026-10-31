import { Failure, TodoListReply, TodoReply, envelope } from "@todo/contract-api";
import { TODO_LIMIT } from "@todo/business/todos/todo.ts";
import { memoryTodos } from "@todo/data-memory/todos.ts";
import * as v from "valibot";
import { expect, it } from "vitest";
import { constructApi, constructOperations, constructRoutes } from "../../src/construct.ts";
import { serve } from "../../src/http.ts";

// The whole route table on the memory store, entered below `constructInfra`
// (A10): no workerd, no database, and a fixed id so the reply is exact.
const app = (newId = () => "id-1") => {
  const operations = constructOperations({ store: memoryTodos(), newId });
  return serve(constructApi(constructRoutes(operations)));
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

it("the memory store refuses the add after the limit", async () => {
  let n = 0;
  const api = app(() => `id-${++n}`);
  const add = () => api.request("/todos", { method: "POST", body: '{"title":"buy milk"}' });
  for (let i = 1; i <= TODO_LIMIT; i++) expect((await add()).status).toBe(201);

  const refused = await add();

  expect(refused.status).toBe(409);
  expect(v.parse(Failure, await refused.json()).error.kind).toBe("limit");
});
