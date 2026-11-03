import { describe, expect, it } from "vitest";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import { type AnyFail, rootOf, unavailable } from "@todo/fail/fail.ts";
import { toggleTodo } from "../../../src/todos/toggle-todo.ts";

/** A fake of the toggle port that gives `answer` and records what it was asked. */
const fakeStore = (answer: Result<Todo | null, AnyFail>) => {
  const asked: { id: string; completed: boolean }[] = [];
  return {
    asked,
    setCompleted: async (id: string, completed: boolean) => {
      asked.push({ id, completed });
      return answer;
    },
  };
};

describe("toggleTodo", () => {
  it("asks the store to set completed and returns the todo as it now is", async () => {
    const todo = { id: "id-1", title: "buy milk", completed: true };
    const dbStore = fakeStore(ok(todo));

    expect(await toggleTodo({ dbStore })("id-1", true)).toEqual({ ok: true, value: todo });
    expect(dbStore.asked).toEqual([{ id: "id-1", completed: true }]);
  });

  it("names a not_found failure when the store has no such todo", async () => {
    const toggled = await toggleTodo({ dbStore: fakeStore(ok(null)) })("id-9", true);

    expect(toggled).toMatchObject({
      ok: false,
      error: { kind: "not_found", message: "no todo has id id-9" },
    });
  });

  it("wraps the store's failure, keeping its kind and root", async () => {
    const down = unavailable("update todo completed: D1_ERROR: Network connection lost.");

    const toggled = await toggleTodo({ dbStore: fakeStore(err(down)) })("id-1", true);

    if (toggled.ok) {
      throw new Error("expected a failure");
    }
    expect(toggled.error.kind).toBe("unavailable");
    expect(toggled.error.message).toBe(
      "toggle todo: update todo completed: D1_ERROR: Network connection lost.",
    );
    expect(rootOf(toggled.error)).toBe(down);
  });
});
