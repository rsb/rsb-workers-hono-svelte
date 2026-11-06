import { describe, expect, it } from "vitest";
import type { Own } from "@todo/business/auth/scope.ts";
import { err, ok } from "@todo/business/result.ts";
import { unavailable } from "@todo/fail/fail.ts";
import { deleteCompleted } from "../../../src/todos/delete-completed.ts";
import { member, own } from "../actors.ts";

describe("deleteCompleted", () => {
  it("asks the store once, in the actor's scope, and returns the todos it says are left", async () => {
    const asked: Own[] = [];
    const todos = [{ id: "id-2", title: "walk dog", completed: false }];
    const dbStore = {
      deleteCompleted: async (scope: Own) => {
        asked.push(scope);
        return ok(todos);
      },
    };

    const deleted = await deleteCompleted({ dbStore })(member);

    expect(asked).toEqual([own]);
    expect(deleted).toEqual({ ok: true, value: todos });
  });

  it("returns the list as it was when no todo is completed", async () => {
    const todos = [{ id: "id-1", title: "buy milk", completed: false }];
    const dbStore = { deleteCompleted: async () => ok(todos) };

    const deleted = await deleteCompleted({ dbStore })(member);

    expect(deleted).toEqual({ ok: true, value: todos });
  });

  it("wraps the store's failure, keeping its kind", async () => {
    const down = unavailable("delete completed: D1_ERROR: Network connection lost.");
    const dbStore = { deleteCompleted: async () => err(down) };

    const deleted = await deleteCompleted({ dbStore })(member);

    if (deleted.ok) {
      throw new Error("expected a failure");
    }
    expect(deleted.error.kind).toBe("unavailable");
    expect(deleted.error.message).toBe("delete completed: delete completed: D1_ERROR: Network connection lost.");
  });
});
