import { Failure, TodoListReply, TodoReply, envelope } from "@todo/contract-api";
import { exports } from "cloudflare:workers";
import * as v from "valibot";
import { expect, it } from "vitest";

const add = async (title: string) => {
  const response = await exports.default.fetch("https://todo-api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  const reply = v.parse(envelope(TodoReply), await response.json());
  if (!reply.ok) {
    throw new Error("the add failed");
  }
  return reply.data;
};

const patch = (id: string, body: unknown) =>
  exports.default.fetch(`https://todo-api/todos/${id}`, { method: "PATCH", body: JSON.stringify(body) });

const listed = async (id: string) => {
  const response = await exports.default.fetch("https://todo-api/todos");
  const reply = v.parse(envelope(TodoListReply), await response.json());
  if (!reply.ok) {
    throw new Error("the list failed");
  }
  return reply.data.find((each) => each.id === id);
};

it("PATCH /todos/:id renames a todo, trimmed, and keeps completed", async () => {
  const todo = await add("buy milk");
  await patch(todo.id, { completed: true });

  const response = await patch(todo.id, { title: "  buy bread  " });

  expect(response.status).toBe(200);
  expect(v.parse(envelope(TodoReply), await response.json())).toEqual({
    ok: true,
    data: { id: todo.id, title: "buy bread", completed: true },
  });
  expect(await listed(todo.id)).toEqual({ id: todo.id, title: "buy bread", completed: true });
});

it("PATCH /todos/:id toggling keeps the title", async () => {
  const todo = await add("walk dog");

  await patch(todo.id, { completed: true });

  expect(await listed(todo.id)).toEqual({ id: todo.id, title: "walk dog", completed: true });
});

it("PATCH /todos/:id changes both fields in one request", async () => {
  const todo = await add("feed cat");

  await patch(todo.id, { title: "feed dog", completed: true });

  expect(await listed(todo.id)).toEqual({ id: todo.id, title: "feed dog", completed: true });
});

it("PATCH /todos/:id refuses an empty title and keeps the old one", async () => {
  const todo = await add("water plants");

  const response = await patch(todo.id, { title: "   " });

  expect(response.status).toBe(422);
  expect(v.parse(Failure, await response.json()).error).toMatchObject({ kind: "validation", field: "title" });
  expect((await listed(todo.id))?.title).toBe("water plants");
});

it("PATCH /todos/:id refuses a title one over the limit", async () => {
  const todo = await add("pay rent");

  const response = await patch(todo.id, { title: "x".repeat(257) });

  expect(response.status).toBe(422);
  expect(v.parse(Failure, await response.json()).error).toMatchObject({ kind: "validation", field: "title" });
});

it("PATCH /todos/:id answers not_found when renaming an id no todo has", async () => {
  const response = await patch("no-such-id", { title: "buy bread" });

  expect(response.status).toBe(404);
});
