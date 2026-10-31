import { expect, it } from "vitest";
import { listTodos } from "../../../../../src/app/operations/todos/list-todos.ts";

it("lists what the store lists", () => {
  const todos = [{ id: "id-1", title: "buy milk", completed: false }];
  expect(listTodos({ store: { list: () => todos } })()).toEqual(todos);
});
