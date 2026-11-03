import { describe, expect, it } from "vitest";
import { loadTodos } from "../../../src/lib/server/todos/load-todos.ts";
import { SOMETHING_WENT_WRONG } from "../../../src/lib/server/todos/messages.ts";

const binding = (reply: () => Promise<Response>) => ({ fetch: reply });

describe("loadTodos", () => {
  it("shows no list and says something went wrong when the API fails", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    expect(await loadTodos(api)).toEqual({ todos: [], error: SOMETHING_WENT_WRONG });
  });

  it("shows the todos", async () => {
    const todos = [{ id: "id-1", title: "buy milk", completed: false }];
    const api = binding(async () => Response.json({ ok: true, data: todos }));
    expect(await loadTodos(api)).toEqual({ todos, error: null });
  });
});
