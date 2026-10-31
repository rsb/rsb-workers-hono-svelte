import { TodoListReply, envelope } from "@todo/contract";
import { exports } from "cloudflare:workers";
import * as v from "valibot";
import { expect, it } from "vitest";

const list = async () => {
  const response = await exports.default.fetch("https://todo-api/todos");
  expect(response.status).toBe(200);
  return v.parse(envelope(TodoListReply), await response.json());
};

const add = (title: string) =>
  exports.default.fetch("https://todo-api/todos", {
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
