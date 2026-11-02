import { expect, it } from "vitest";
import { newTodo } from "../../../src/todos/todo.ts";

it("a new todo is not completed", () => {
  const todo = newTodo("id-1", { title: "buy milk" });

  expect(todo).toEqual({ id: "id-1", title: "buy milk", completed: false });
});
