import { describe, expect, it } from "vitest";
import { loadTodos } from "../../../src/lib/server/todos/load-todos.ts";

const binding = (reply: () => Promise<Response>) => ({ fetch: reply });

describe("loadTodos", () => {
  it("shows no list and a message when the API fails", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    expect(await loadTodos(api)).toEqual({ todos: [], error: "The todos could not be loaded." });
  });

  it("shows the todos", async () => {
    const todos = [{ id: "id-1", title: "buy milk", completed: false }];
    const api = binding(async () => Response.json({ ok: true, data: todos }));
    expect(await loadTodos(api)).toEqual({ todos, error: null });
  });
});
