import { describe, expect, it } from "vitest";
import type { Own } from "@todo/business/auth/scope.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, rootOf, unavailable } from "@todo/fail/fail.ts";
import { deleteTodo } from "../../../src/todos/delete-todo.ts";
import { member, own } from "../actors.ts";

/** A fake of the delete port that gives `answer` and records what it was asked. */
const fakeStore = (answer: Result<boolean, AnyFail>) => {
  const asked: { scope: Own; id: string }[] = [];
  return {
    asked,
    deleteTodo: async (scope: Own, id: string) => {
      asked.push({ scope, id });
      return answer;
    },
  };
};

describe("deleteTodo", () => {
  it("asks the store to delete the todo in the actor's scope and returns its id", async () => {
    const dbStore = fakeStore(ok(true));

    const deleted = await deleteTodo({ dbStore })(member, "id-1");

    expect(deleted).toEqual({ ok: true, value: "id-1" });
    expect(dbStore.asked).toEqual([{ scope: own, id: "id-1" }]);
  });

  it("todo.exists: names a not_found failure when the store deleted nothing", async () => {
    const deleted = await deleteTodo({ dbStore: fakeStore(ok(false)) })(member, "id-9");

    expect(deleted).toMatchObject({
      ok: false,
      error: { kind: "not_found", message: "no todo has id id-9" },
    });
  });

  it("todo.owned: names not_found for another's todo, as for a missing one", async () => {
    // A store that holds id-2 for u2 and, as the real one does, deletes a
    // todo only in the scope it is given.
    const dbStore = { deleteTodo: async (scope: Own, id: string) => ok(scope.ownerId === "u2" && id === "id-2") };

    const deleted = await deleteTodo({ dbStore })(member, "id-2");

    expect(deleted).toMatchObject({ ok: false, error: { kind: "not_found", message: "no todo has id id-2" } });
  });

  it("wraps the store's failure, keeping its kind and root", async () => {
    const down = unavailable("delete todo: D1_ERROR: Network connection lost.");

    const deleted = await deleteTodo({ dbStore: fakeStore(err(down)) })(member, "id-1");

    if (deleted.ok) {
      throw new Error("expected a failure");
    }
    expect(deleted.error.kind).toBe("unavailable");
    expect(deleted.error.message).toBe("delete todo: delete todo: D1_ERROR: Network connection lost.");
    expect(rootOf(deleted.error)).toBe(down);
  });
});
