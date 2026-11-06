import { TodoListReply, envelope } from "@todo/contract-api";
import * as v from "valibot";
import { expect, it } from "vitest";
import { asMember } from "./signed-in.ts";

const list = async () => {
  const response = await asMember("https://todo-api/todos");
  expect(response.status).toBe(200);
  return v.parse(envelope(TodoListReply), await response.json());
};

const add = (title: string) =>
  asMember("https://todo-api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });

it("GET /todos lists nothing before the first add", async () => {
  expect(await list()).toEqual({ ok: true, data: [] });
});

it("GET /todos lists todos in creation order, across requests", async () => {
  await add("buy milk");
  await add("walk dog");

  const reply = await list();
  expect(reply.ok && reply.data.map((todo) => todo.title)).toEqual(["buy milk", "walk dog"]);
});
