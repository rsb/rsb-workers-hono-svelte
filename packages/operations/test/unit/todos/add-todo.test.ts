import { describe, expect, it } from "vitest";
import { type Result, err, ok } from "@todo/business/result.ts";
import { TODO_LIMIT } from "@todo/business/rules.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import { type AnyFail, rootOf, unavailable } from "@todo/fail/fail.ts";
import { addTodo } from "../../../src/todos/add-todo.ts";
import { member, own } from "../actors.ts";

/** A fake of the add port that gives `answer` and records what it was asked. */
const fakeStore = (answer: Result<boolean, AnyFail>) => {
  const asked: { scope: Own; todo: Todo; limit: number }[] = [];
  return {
    asked,
    addTodoUnlessFull: async (scope: Own, todo: Todo, limit: number) => {
      asked.push({ scope, todo, limit });
      return answer;
    },
  };
};

describe("addTodo", () => {
  it("asks the store to add an active todo with the injected id to the actor's list, up to the limit", async () => {
    const dbStore = fakeStore(ok(true));
    const add = addTodo({ dbStore, newId: () => "id-1" });
    const todo = { id: "id-1", title: "buy milk", completed: false };

    expect(await add(member, { title: "buy milk" })).toEqual({ ok: true, value: todo });
    expect(dbStore.asked).toEqual([{ scope: own, todo, limit: TODO_LIMIT }]);
  });

  it("todos.cap: names a limit failure when the store did not insert", async () => {
    const add = addTodo({ dbStore: fakeStore(ok(false)), newId: () => "id-1" });

    const added = await add(member, { title: "buy milk" });

    expect(added).toMatchObject({
      ok: false,
      error: { kind: "limit", message: "the list is full" },
    });
  });

  it("wraps the store's failure, keeping its kind and root", async () => {
    const down = unavailable("insert todo unless full: D1_ERROR: Network connection lost.");
    const add = addTodo({ dbStore: fakeStore(err(down)), newId: () => "id-1" });

    const added = await add(member, { title: "buy milk" });

    if (added.ok) {
      throw new Error("expected a failure");
    }
    expect(added.error.kind).toBe("unavailable");
    expect(added.error.message).toBe(
      "add todo: insert todo unless full: D1_ERROR: Network connection lost.",
    );
    expect(rootOf(added.error)).toBe(down);
  });
});
