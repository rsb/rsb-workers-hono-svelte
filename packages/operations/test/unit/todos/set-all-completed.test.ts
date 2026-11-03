import { describe, expect, it } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { unavailable } from "@todo/fail/fail.ts";
import { setAllCompleted } from "../../../src/todos/set-all-completed.ts";

describe("setAllCompleted", () => {
  it("asks the store for the value given and returns what it lists", async () => {
    const asked: boolean[] = [];
    const todos = [
      { id: "id-1", title: "buy milk", completed: true },
      { id: "id-2", title: "walk dog", completed: true },
    ];
    const dbStore = {
      setAllCompleted: async (completed: boolean) => {
        asked.push(completed);
        return ok(todos);
      },
    };

    const set = await setAllCompleted({ dbStore })(true);

    expect(asked).toEqual([true]);
    expect(set).toEqual({ ok: true, value: todos });
  });

  it("returns an empty list when there are no todos", async () => {
    const dbStore = { setAllCompleted: async () => ok([]) };

    const set = await setAllCompleted({ dbStore })(false);

    expect(set).toEqual({ ok: true, value: [] });
  });

  it("wraps the store's failure, keeping its kind", async () => {
    const down = unavailable("set all completed: D1_ERROR: Network connection lost.");
    const dbStore = { setAllCompleted: async () => err(down) };

    const set = await setAllCompleted({ dbStore })(true);

    if (set.ok) {
      throw new Error("expected a failure");
    }
    expect(set.error.kind).toBe("unavailable");
    expect(set.error.message).toBe(
      "set all completed: set all completed: D1_ERROR: Network connection lost.",
    );
  });
});
