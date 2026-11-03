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

const toggle = (id: string, body: string) =>
  exports.default.fetch(`https://todo-api/todos/${id}`, { method: "PATCH", body });

it("PATCH /todos/:id completes a todo, and the next list shows it", async () => {
  const todo = await add("buy milk");

  const response = await toggle(todo.id, '{"completed":true}');

  expect(response.status).toBe(200);
  expect(v.parse(envelope(TodoReply), await response.json())).toEqual({
    ok: true,
    data: { id: todo.id, title: "buy milk", completed: true },
  });
  const listed = await exports.default.fetch("https://todo-api/todos");
  const reply = v.parse(envelope(TodoListReply), await listed.json());
  expect(reply.ok && reply.data.find((each) => each.id === todo.id)?.completed).toBe(true);
});

it("PATCH /todos/:id makes a completed todo active again", async () => {
  const todo = await add("walk dog");
  await toggle(todo.id, '{"completed":true}');

  const response = await toggle(todo.id, '{"completed":false}');

  expect(v.parse(envelope(TodoReply), await response.json())).toMatchObject({
    data: { completed: false },
  });
});

it("PATCH /todos/:id answers not_found for an id no todo has", async () => {
  const response = await toggle("no-such-id", '{"completed":true}');

  expect(response.status).toBe(404);
  expect(v.parse(Failure, await response.json()).error.kind).toBe("not_found");
});

it("PATCH /todos/:id answers validation for an unknown field", async () => {
  const todo = await add("feed cat");

  const response = await toggle(todo.id, '{"completed":true,"done":true}');

  expect(response.status).toBe(422);
  expect(v.parse(Failure, await response.json()).error).toMatchObject({ kind: "validation", field: "done" });
});
