import { expect, it } from "vitest";
import { newTodo } from "../../../src/todos/todo.ts";

it("a new todo is not completed", () => {
  expect(newTodo("id-1", "buy milk")).toEqual({ id: "id-1", title: "buy milk", completed: false });
});
