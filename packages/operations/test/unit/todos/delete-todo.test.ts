import { describe, expect, it } from "vitest";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, rootOf, unavailable } from "@todo/fail/fail.ts";
import { deleteTodo } from "../../../src/todos/delete-todo.ts";

/** A fake of the delete port that gives `answer` and records what it was asked. */
const fakeStore = (answer: Result<boolean, AnyFail>) => {
  const asked: string[] = [];
  return {
    asked,
    deleteTodo: async (id: string) => {
      asked.push(id);
      return answer;
    },
  };
};

describe("deleteTodo", () => {
  it("asks the store to delete the todo and returns its id", async () => {
    const dbStore = fakeStore(ok(true));

    const deleted = await deleteTodo({ dbStore })("id-1");

    expect(deleted).toEqual({ ok: true, value: "id-1" });
    expect(dbStore.asked).toEqual(["id-1"]);
  });

  it("names a not_found failure when the store deleted nothing", async () => {
    const deleted = await deleteTodo({ dbStore: fakeStore(ok(false)) })("id-9");

    expect(deleted).toMatchObject({
      ok: false,
      error: { kind: "not_found", message: "no todo has id id-9" },
    });
  });

  it("wraps the store's failure, keeping its kind and root", async () => {
    const down = unavailable("delete todo: D1_ERROR: Network connection lost.");

    const deleted = await deleteTodo({ dbStore: fakeStore(err(down)) })("id-1");

    if (deleted.ok) {
      throw new Error("expected a failure");
    }
    expect(deleted.error.kind).toBe("unavailable");
    expect(deleted.error.message).toBe("delete todo: delete todo: D1_ERROR: Network connection lost.");
    expect(rootOf(deleted.error)).toBe(down);
  });
});
