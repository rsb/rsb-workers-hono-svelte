import { describe, expect, it } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { unavailable } from "@todo/fail/fail.ts";
import { deleteCompleted } from "../../../src/todos/delete-completed.ts";

describe("deleteCompleted", () => {
  it("asks the store once and returns the todos it says are left", async () => {
    let asked = 0;
    const todos = [{ id: "id-2", title: "walk dog", completed: false }];
    const dbStore = {
      deleteCompleted: async () => {
        asked += 1;
        return ok(todos);
      },
    };

    const deleted = await deleteCompleted({ dbStore })();

    expect(asked).toBe(1);
    expect(deleted).toEqual({ ok: true, value: todos });
  });

  it("returns the list as it was when no todo is completed", async () => {
    const todos = [{ id: "id-1", title: "buy milk", completed: false }];
    const dbStore = { deleteCompleted: async () => ok(todos) };

    const deleted = await deleteCompleted({ dbStore })();

    expect(deleted).toEqual({ ok: true, value: todos });
  });

  it("wraps the store's failure, keeping its kind", async () => {
    const down = unavailable("delete completed: D1_ERROR: Network connection lost.");
    const dbStore = { deleteCompleted: async () => err(down) };

    const deleted = await deleteCompleted({ dbStore })();

    if (deleted.ok) {
      throw new Error("expected a failure");
    }
    expect(deleted.error.kind).toBe("unavailable");
    expect(deleted.error.message).toBe("delete completed: delete completed: D1_ERROR: Network connection lost.");
  });
});
