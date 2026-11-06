import { describe, expect, it } from "vitest";
import type { Own } from "@todo/business/auth/scope.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import type { Todo, TodoPatch } from "@todo/business/todos/todo.ts";
import { type AnyFail, rootOf, unavailable } from "@todo/fail/fail.ts";
import { updateTodo } from "../../../src/todos/update-todo.ts";
import { member, own } from "../actors.ts";

/** A fake of the update port that gives `answer` and records what it was asked. */
const fakeStore = (answer: Result<Todo | null, AnyFail>) => {
  const asked: { scope: Own; id: string; patch: TodoPatch }[] = [];
  return {
    asked,
    updateTodo: async (scope: Own, id: string, patch: TodoPatch) => {
      asked.push({ scope, id, patch });
      return answer;
    },
  };
};

describe("updateTodo", () => {
  it("asks the store to apply the patch in the actor's scope and returns the todo as it now is", async () => {
    const todo = { id: "id-1", title: "buy bread", completed: true };
    const dbStore = fakeStore(ok(todo));

    const updated = await updateTodo({ dbStore })(member, "id-1", { title: "buy bread", completed: true });

    expect(updated).toEqual({ ok: true, value: todo });
    expect(dbStore.asked).toEqual([{ scope: own, id: "id-1", patch: { title: "buy bread", completed: true } }]);
  });

  it("todo.exists: names a not_found failure when the store has no such todo", async () => {
    const updated = await updateTodo({ dbStore: fakeStore(ok(null)) })(member, "id-9", { completed: true });

    expect(updated).toMatchObject({
      ok: false,
      error: { kind: "not_found", message: "no todo has id id-9" },
    });
  });

  it("todo.owned: names not_found for another's todo, as for a missing one", async () => {
    // A store that holds id-2 for u2 and, as the real one does, matches a
    // todo only in the scope it is given.
    const theirs = { id: "id-2", title: "their todo", completed: false };
    const dbStore = {
      updateTodo: async (scope: Own, id: string) => ok(scope.ownerId === "u2" && id === theirs.id ? theirs : null),
    };

    const updated = await updateTodo({ dbStore })(member, "id-2", { completed: true });

    expect(updated).toMatchObject({ ok: false, error: { kind: "not_found", message: "no todo has id id-2" } });
  });

  it("wraps the store's failure, keeping its kind and root", async () => {
    const down = unavailable("update todo: D1_ERROR: Network connection lost.");

    const updated = await updateTodo({ dbStore: fakeStore(err(down)) })(member, "id-1", { completed: true });

    if (updated.ok) {
      throw new Error("expected a failure");
    }
    expect(updated.error.kind).toBe("unavailable");
    expect(updated.error.message).toBe("update todo: update todo: D1_ERROR: Network connection lost.");
    expect(rootOf(updated.error)).toBe(down);
  });
});
