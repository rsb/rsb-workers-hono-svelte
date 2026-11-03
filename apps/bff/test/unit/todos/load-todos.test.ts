import { describe, expect, it } from "vitest";
import { loadTodos } from "../../../src/lib/server/todos/load-todos.ts";
import { SOMETHING_WENT_WRONG } from "../../../src/lib/server/todos/messages.ts";

const binding = (reply: () => Promise<Response>) => ({ fetch: reply });

/** A fake binding that answers by path, and records each URL it was asked. */
const routed = (replies: Record<string, () => Promise<Response>>) => {
  const asked: string[] = [];
  const fetch = async (url: string) => {
    asked.push(url);
    const path = url.replace("https://todo-api", "");
    const reply = replies[path];
    if (reply === undefined) {
      throw new Error(`no reply for ${path}`);
    }
    return reply();
  };
  return { api: { fetch }, asked };
};

const active = { id: "id-1", title: "buy milk", completed: false };
const counts = { active: 1, completed: 3 };

describe("loadTodos on /", () => {
  it("shows no list and says something went wrong when the API fails", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    expect(await loadTodos(api, "all")).toEqual({
      filter: "all",
      todos: [],
      active: 0,
      completed: 0,
      error: SOMETHING_WENT_WRONG,
    });
  });

  it("shows the todos and counts the active and the completed ones", async () => {
    const todos = [
      { id: "id-1", title: "buy milk", completed: false },
      { id: "id-2", title: "walk dog", completed: true },
      { id: "id-3", title: "feed cat", completed: false },
    ];
    const api = binding(async () => Response.json({ ok: true, data: todos }));
    expect(await loadTodos(api, "all")).toEqual({ filter: "all", todos, active: 2, completed: 1, error: null });
  });
});

describe("loadTodos on a filter", () => {
  it("asks the API for the filtered list and for the counts of every todo", async () => {
    const { api, asked } = routed({
      "/todos?completed=false": async () => Response.json({ ok: true, data: [active] }),
      "/todos/counts": async () => Response.json({ ok: true, data: counts }),
    });

    const page = await loadTodos(api, "active");

    expect(page).toEqual({ filter: "active", todos: [active], active: 1, completed: 3, error: null });
    expect(asked.sort()).toEqual(["https://todo-api/todos/counts", "https://todo-api/todos?completed=false"]);
  });

  it("asks for completed=true on /completed", async () => {
    const { api, asked } = routed({
      "/todos?completed=true": async () => Response.json({ ok: true, data: [] }),
      "/todos/counts": async () => Response.json({ ok: true, data: counts }),
    });

    await loadTodos(api, "completed");

    expect(asked).toContain("https://todo-api/todos?completed=true");
  });

  it("fails as a whole when the list fails, though the counts did not", async () => {
    const { api } = routed({
      "/todos?completed=false": () => Promise.reject(new Error("binding failed")),
      "/todos/counts": async () => Response.json({ ok: true, data: counts }),
    });

    expect(await loadTodos(api, "active")).toEqual({
      filter: "active",
      todos: [],
      active: 0,
      completed: 0,
      error: SOMETHING_WENT_WRONG,
    });
  });

  it("fails as a whole when the counts fail, though the list did not", async () => {
    const { api } = routed({
      "/todos?completed=true": async () => Response.json({ ok: true, data: [] }),
      "/todos/counts": async () => Response.json({ ok: false, error: { kind: "internal", message: "internal error" } }),
    });

    const page = await loadTodos(api, "completed");

    expect(page.error).toBe(SOMETHING_WENT_WRONG);
    expect(page.todos).toEqual([]);
  });
});
