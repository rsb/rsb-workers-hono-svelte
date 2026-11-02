import { describe, expect, it } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { unavailable } from "@todo/fail/fail.ts";
import { listTodos } from "../../../src/todos/list-todos.ts";

describe("listTodos", () => {
  it("lists what the store lists", async () => {
    const todos = [{ id: "id-1", title: "buy milk", completed: false }];
    const dbStore = { listTodos: async () => ok(todos) };

    const listed = await listTodos({ dbStore })();

    expect(listed).toEqual({ ok: true, value: todos });
  });

  it("wraps the store's failure, keeping its kind", async () => {
    const down = unavailable("select todos: D1_ERROR: Network connection lost.");
    const dbStore = { listTodos: async () => err(down) };

    const listed = await listTodos({ dbStore })();

    if (listed.ok) {
      throw new Error("expected a failure");
    }
    expect(listed.error.kind).toBe("unavailable");
    expect(listed.error.message).toBe("list todos: select todos: D1_ERROR: Network connection lost.");
  });
});
