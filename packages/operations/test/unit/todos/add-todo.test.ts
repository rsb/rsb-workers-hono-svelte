import { describe, expect, it } from "vitest";
import { TODO_LIMIT, type Todo } from "@todo/business/todos/todo.ts";
import { addTodo } from "../../../src/todos/add-todo.ts";

/** A fake store that answers `answer` and records what it was asked. */
const fakeStore = (answer: "added" | "full") => {
  const asked: { todo: Todo; limit: number }[] = [];
  return {
    asked,
    addUnlessFull: async (todo: Todo, limit: number) => {
      asked.push({ todo, limit });
      return answer;
    },
  };
};

describe("addTodo", () => {
  it("is full when the store refuses the add", async () => {
    const add = addTodo({ store: fakeStore("full"), newId: () => "id-1" });

    expect(await add("buy milk")).toEqual({ ok: false, error: { kind: "full" } });
  });

  it("asks the store to add an active todo with the injected id, up to the limit", async () => {
    const store = fakeStore("added");
    const add = addTodo({ store, newId: () => "id-1" });
    const todo = { id: "id-1", title: "buy milk", completed: false };

    expect(await add("buy milk")).toEqual({ ok: true, value: todo });
    expect(store.asked).toEqual([{ todo, limit: TODO_LIMIT }]);
  });
});
