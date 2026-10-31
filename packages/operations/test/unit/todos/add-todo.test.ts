import { describe, expect, it } from "vitest";
import { TODO_LIMIT, type Todo } from "@todo/business/todos/todo.ts";
import { addTodo } from "../../../src/todos/add-todo.ts";

/** A fake store that starts with `count` todos and records what is added. */
const fakeStore = (count: number) => {
  const added: Todo[] = [];
  return { added, count: () => count + added.length, add: (todo: Todo) => void added.push(todo) };
};

describe("addTodo", () => {
  it("is full when the list holds the limit", () => {
    const store = fakeStore(TODO_LIMIT);
    const add = addTodo({ store, newId: () => "id-1" });

    expect(add("buy milk")).toEqual({ ok: false, error: { kind: "full" } });
    expect(store.added).toEqual([]);
  });

  it("adds an active todo with the injected id", () => {
    const store = fakeStore(TODO_LIMIT - 1);
    const add = addTodo({ store, newId: () => "id-1" });
    const todo = { id: "id-1", title: "buy milk", completed: false };

    expect(add("buy milk")).toEqual({ ok: true, value: todo });
    expect(store.added).toEqual([todo]);
  });
});
