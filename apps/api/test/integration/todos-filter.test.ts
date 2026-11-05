import { TodoCountsReply, TodoListReply, envelope } from "@todo/contract-api";
import { exports } from "cloudflare:workers";
import * as v from "valibot";
import { expect, it } from "vitest";

const fetchApi = (path: string, init?: RequestInit) => exports.default.fetch(`https://todo-api${path}`, init);

const titles = async (query: string) => {
  const response = await fetchApi(`/todos${query}`);
  expect(response.status).toBe(200);
  const reply = v.parse(envelope(TodoListReply), await response.json());
  return reply.ok && reply.data.map((todo) => todo.title);
};

const counts = async () => {
  const response = await fetchApi("/todos/counts");
  expect(response.status).toBe(200);
  return v.parse(envelope(TodoCountsReply), await response.json());
};

it("GET /todos/counts counts nothing before the first add", async () => {
  expect(await counts()).toEqual({ ok: true, data: { active: 0, completed: 0 } });
});

it("GET /todos?completed= lists only the todos asked for, in creation order", async () => {
  for (const title of ["buy milk", "walk dog", "call mum"]) {
    await fetchApi("/todos", { method: "POST", body: JSON.stringify({ title }) });
  }
  const listed = v.parse(envelope(TodoListReply), await (await fetchApi("/todos")).json());
  if (!listed.ok) {
    throw new Error("expected a list");
  }
  const [first, , third] = listed.data;
  for (const todo of [first, third]) {
    await fetchApi(`/todos/${todo?.id}`, { method: "PATCH", body: '{"completed":true}' });
  }

  expect(await titles("?completed=true")).toEqual(["buy milk", "call mum"]);
  expect(await titles("?completed=false")).toEqual(["walk dog"]);
  expect(await titles("")).toEqual(["buy milk", "walk dog", "call mum"]);
  expect(await counts()).toEqual({ ok: true, data: { active: 1, completed: 2 } });
});
