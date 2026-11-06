import { describe, expect, it } from "vitest";
import type { Own } from "@todo/business/auth/scope.ts";
import { err, ok } from "@todo/business/result.ts";
import { unavailable } from "@todo/fail/fail.ts";
import { countTodos } from "../../../src/todos/count-todos.ts";
import { member, own } from "../actors.ts";

describe("countTodos", () => {
  it("gives what the store counts in the actor's scope", async () => {
    const asked: Own[] = [];
    const dbStore = {
      countTodos: async (scope: Own) => {
        asked.push(scope);
        return ok({ active: 2, completed: 1 });
      },
    };

    const counted = await countTodos({ dbStore })(member);

    expect(counted).toEqual({ ok: true, value: { active: 2, completed: 1 } });
    expect(asked).toEqual([own]);
  });

  it("wraps the store's failure, keeping its kind", async () => {
    const down = unavailable("count todos: D1_ERROR: Network connection lost.");
    const dbStore = { countTodos: async () => err(down) };

    const counted = await countTodos({ dbStore })(member);

    if (counted.ok) {
      throw new Error("expected a failure");
    }
    expect(counted.error.kind).toBe("unavailable");
    expect(counted.error.message).toBe("count todos: count todos: D1_ERROR: Network connection lost.");
  });
});
