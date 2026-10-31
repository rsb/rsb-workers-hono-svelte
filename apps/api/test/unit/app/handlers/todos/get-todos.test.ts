import { TodoListReply, envelope } from "@todo/contract-api";
import { Context } from "hono";
import * as v from "valibot";
import { expect, it } from "vitest";
import { getTodos } from "../../../../../src/app/handlers/todos/get-todos.ts";

it("presents every todo the operation lists", async () => {
  const todos = [
    { id: "id-1", title: "buy milk", completed: false },
    { id: "id-2", title: "walk dog", completed: true },
  ];
  const response = await getTodos(async () => todos)(new Context(new Request("https://todo-api/todos")));

  expect(response.status).toBe(200);
  expect(v.parse(envelope(TodoListReply), await response.json())).toEqual({ ok: true, data: todos });
});
