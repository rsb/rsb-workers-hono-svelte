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

const complete = (id: string) =>
  asMember(`https://todo-api/todos/${id}`, { method: "PATCH", body: '{"completed":true}' });

const clear = (query: string) => asMember(`https://todo-api/todos${query}`, { method: "DELETE" });

const listedIds = async () => {
  const response = await asMember("https://todo-api/todos");
  const reply = v.parse(envelope(TodoListReply), await response.json());
  if (!reply.ok) {
    throw new Error("the list failed");
  }
  return reply.data.map((each) => each.id);
};

it("DELETE /todos?completed=true deletes the completed todos only and answers the rest, in creation order", async () => {
  const milk = await add("buy milk");
  const dog = await add("walk dog");
  const cat = await add("feed cat");
  await complete(milk.id);

  const response = await clear("?completed=true");

  expect(response.status).toBe(200);
  const reply = v.parse(envelope(TodoListReply), await response.json());
  const ids = reply.ok && reply.data.map((each) => each.id);
  expect(ids).not.toContain(milk.id);
  expect(reply.ok && reply.data.every((each) => !each.completed)).toBe(true);
  const dogAt = reply.ok && reply.data.findIndex((each) => each.id === dog.id);
  const catAt = reply.ok && reply.data.findIndex((each) => each.id === cat.id);
  expect(dogAt).toBeLessThan(Number(catAt));
  expect(await listedIds()).toEqual(ids);
});

it("DELETE /todos?completed=true with nothing completed answers the list as it was", async () => {
  await add("water plants");
  const before = await listedIds();

  const response = await clear("?completed=true");

  expect(response.status).toBe(200);
  const reply = v.parse(envelope(TodoListReply), await response.json());
  expect(reply.ok && reply.data.map((each) => each.id)).toEqual(before);
});

it("DELETE /todos without completed=true is validation and deletes nothing", async () => {
  const kept = await add("post letter");
  await complete(kept.id);

  const response = await clear("");

  expect(response.status).toBe(422);
  expect(v.parse(Failure, await response.json()).error).toMatchObject({ kind: "validation", field: "completed" });
  expect(await listedIds()).toContain(kept.id);
});
