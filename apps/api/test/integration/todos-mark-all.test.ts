import { Failure, TodoListReply, TodoReply, envelope } from "@todo/contract-api";
import * as v from "valibot";
import { expect, it } from "vitest";
import { asMember } from "./signed-in.ts";

const add = async (title: string) => {
  const response = await asMember("https://todo-api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  const reply = v.parse(envelope(TodoReply), await response.json());
  if (!reply.ok) {
    throw new Error("the add failed");
  }
  return reply.data;
};

const markAll = (body: string) => asMember("https://todo-api/todos", { method: "PATCH", body });

const list = async () => {
  const response = await asMember("https://todo-api/todos");
  return v.parse(envelope(TodoListReply), await response.json());
};

it("PATCH /todos with no todos answers an empty list", async () => {
  const response = await markAll('{"completed":true}');

  expect(response.status).toBe(200);
  expect(v.parse(envelope(TodoListReply), await response.json())).toEqual({ ok: true, data: [] });
});

it("PATCH /todos completes every todo, in creation order, and the next list shows it", async () => {
  const first = await add("buy milk");
  const second = await add("walk dog");

  const response = await markAll('{"completed":true}');

  expect(response.status).toBe(200);
  expect(v.parse(envelope(TodoListReply), await response.json())).toEqual({
    ok: true,
    data: [
      { id: first.id, title: "buy milk", completed: true },
      { id: second.id, title: "walk dog", completed: true },
    ],
  });
  const listed = await list();
  expect(listed.ok && listed.data.every((todo) => todo.completed)).toBe(true);
});

it("PATCH /todos makes every todo active again, and sending it twice changes nothing more", async () => {
  await add("feed cat");
  await markAll('{"completed":true}');

  await markAll('{"completed":false}');
  const again = await markAll('{"completed":false}');

  const reply = v.parse(envelope(TodoListReply), await again.json());
  expect(reply.ok && reply.data.length > 0).toBe(true);
  expect(reply.ok && reply.data.every((todo) => !todo.completed)).toBe(true);
});

it("PATCH /todos answers validation for a body without completed", async () => {
  const response = await markAll("{}");

  expect(response.status).toBe(422);
  expect(v.parse(Failure, await response.json()).error).toMatchObject({ kind: "validation", field: "completed" });
});
