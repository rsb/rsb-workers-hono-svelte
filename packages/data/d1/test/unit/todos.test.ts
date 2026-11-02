import { expect, it } from "vitest";
import { toRow, toTodo } from "../../src/todos.ts";

it("stores completed as 0 or 1", () => {
  expect(toRow({ id: "id-1", title: "buy milk", completed: false }).completed).toBe(0);
  expect(toRow({ id: "id-1", title: "buy milk", completed: true }).completed).toBe(1);
});

it("reads a row back as the todo it was", () => {
  const todo = { id: "id-1", title: "buy milk", completed: true };
  expect(toTodo(toRow(todo))).toEqual(todo);
});
