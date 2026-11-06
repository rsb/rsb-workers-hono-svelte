import { describe, expect, it } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import type { TodoFilter } from "@todo/business/todos/todo.ts";
import { unavailable } from "@todo/fail/fail.ts";
import { listTodos } from "../../../src/todos/list-todos.ts";
import { member, own } from "../actors.ts";

describe("listTodos", () => {
  it("lists what the store lists", async () => {
    const todos = [{ id: "id-1", title: "buy milk", completed: false }];
    const dbStore = { listTodos: async () => ok(todos) };

    const listed = await listTodos({ dbStore })(member, {});

    expect(listed).toEqual({ ok: true, value: todos });
  });

  it("passes the actor's scope and the filter to the store", async () => {
    const asked: { scope: Own; filter: TodoFilter }[] = [];
    const dbStore = {
      listTodos: async (scope: Own, filter: TodoFilter) => {
        asked.push({ scope, filter });
        return ok([]);
      },
    };

    await listTodos({ dbStore })(member, { completed: true });

    expect(asked).toEqual([{ scope: own, filter: { completed: true } }]);
  });

  it("wraps the store's failure, keeping its kind", async () => {
    const down = unavailable("select todos: D1_ERROR: Network connection lost.");
    const dbStore = { listTodos: async () => err(down) };

    const listed = await listTodos({ dbStore })(member, {});

    if (listed.ok) {
      throw new Error("expected a failure");
    }
    expect(listed.error.kind).toBe("unavailable");
    expect(listed.error.message).toBe("list todos: select todos: D1_ERROR: Network connection lost.");
  });
});
