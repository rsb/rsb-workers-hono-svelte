import { expect, it } from "vitest";
import { listTodos } from "../../../src/todos/list-todos.ts";

it("lists what the store lists", async () => {
  const todos = [{ id: "id-1", title: "buy milk", completed: false }];
  expect(await listTodos({ store: { list: async () => todos } })()).toEqual(todos);
});
