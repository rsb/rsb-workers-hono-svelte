import { DeletedReply, Failure, TodoListReply, TodoReply, envelope } from "@todo/contract-api";
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

const remove = (id: string) => asMember(`https://todo-api/todos/${id}`, { method: "DELETE" });

const listedIds = async () => {
  const response = await asMember("https://todo-api/todos");
  const reply = v.parse(envelope(TodoListReply), await response.json());
  if (!reply.ok) {
    throw new Error("the list failed");
  }
  return reply.data.map((each) => each.id);
};

it("DELETE /todos/:id deletes that todo only and answers its id", async () => {
  const milk = await add("buy milk");
  const dog = await add("walk dog");

  const response = await remove(milk.id);

  expect(response.status).toBe(200);
  expect(v.parse(envelope(DeletedReply), await response.json())).toEqual({ ok: true, data: { id: milk.id } });
  const ids = await listedIds();
  expect(ids).not.toContain(milk.id);
  expect(ids).toContain(dog.id);
});

it("DELETE /todos/:id answers not_found for an id no todo has, or one already deleted", async () => {
  const todo = await add("buy milk");
  await remove(todo.id);

  const again = await remove(todo.id);
  const unknown = await remove("no-such-id");

  expect(again.status).toBe(404);
  expect(v.parse(Failure, await again.json()).error.kind).toBe("not_found");
  expect(unknown.status).toBe(404);
  expect(v.parse(Failure, await unknown.json()).error.kind).toBe("not_found");
});
