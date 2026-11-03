import { describe, expect, it } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { unavailable } from "@todo/fail/fail.ts";
import { countTodos } from "../../../src/todos/count-todos.ts";

describe("countTodos", () => {
  it("gives what the store counts", async () => {
    const dbStore = { countTodos: async () => ok({ active: 2, completed: 1 }) };

    const counted = await countTodos({ dbStore })();

    expect(counted).toEqual({ ok: true, value: { active: 2, completed: 1 } });
  });

  it("wraps the store's failure, keeping its kind", async () => {
    const down = unavailable("count todos: D1_ERROR: Network connection lost.");
    const dbStore = { countTodos: async () => err(down) };

    const counted = await countTodos({ dbStore })();

    if (counted.ok) {
      throw new Error("expected a failure");
    }
    expect(counted.error.kind).toBe("unavailable");
    expect(counted.error.message).toBe("count todos: count todos: D1_ERROR: Network connection lost.");
  });
});
