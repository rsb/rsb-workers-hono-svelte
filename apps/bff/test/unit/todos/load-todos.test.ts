import { isHttpError } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { loadTodos } from "../../../src/lib/server/todos/load-todos.ts";
import { RETRY, shellError } from "../../../src/lib/shell/views.ts";

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

const refusing = (error: object, status: number) => async () => Response.json({ ok: false, error }, { status });
const anonymous = refusing({ kind: "unauthenticated", message: "for developers" }, 401);
const internal = refusing({ kind: "internal", message: "for developers" }, 500);

/**
 * What a load returned, or the status `handleError` gives what it threw.
 * A failed read is a fault (kind `unknown`), not an `error()` the page chose.
 */
const thrown = async (load: Promise<unknown>) => {
  try {
    return { returned: await load };
  } catch (caught) {
    if (isHttpError(caught)) {
      throw new Error(`expected a fault, and the load threw error(${caught.status})`);
    }
    return { status: shellError({ kind: "unknown", error: caught }).status };
  }
};

const active = { id: "id-1", title: "buy milk", completed: false };
const counts = { active: 1, completed: 3 };

describe("loadTodos on /", () => {
  it("A.7 given the api fails, the page shows the shell's failed view: Something went wrong, and Try again", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));

    const result = await thrown(loadTodos(api, "all"));

    // handleError makes the fault a 500 with the failed view, which
    // +error.svelte draws in the frame.
    expect(result).toEqual({ status: 500 });
    const { view } = shellError({ kind: "unknown", error: new Error("binding failed") });
    expect(view.title).toBe("Something went wrong");
    expect(view.retry).toBe(true);
    expect(RETRY).toBe("Try again");
  });

  it("is the shell's signed_out when the runner refuses the read as unauthenticated", async () => {
    expect(await loadTodos(binding(anonymous), "all")).toEqual({ state: "signed_out" });
  });

  it.each([
    ["channel", 403],
    ["account_disabled", 403],
    ["role", 403],
  ])("fails as a 500 when the read is refused as forbidden, reason %s, until D", async (reason, status) => {
    const api = binding(refusing({ kind: "forbidden", reason, message: "for developers" }, status));
    expect(await thrown(loadTodos(api, "all"))).toEqual({ status: 500 });
  });

  it("shows the todos and counts the active and the completed ones", async () => {
    const todos = [
      { id: "id-1", title: "buy milk", completed: false },
      { id: "id-2", title: "walk dog", completed: true },
      { id: "id-3", title: "feed cat", completed: false },
    ];
    const api = binding(async () => Response.json({ ok: true, data: todos }));
    expect(await loadTodos(api, "all")).toEqual({ state: "list", filter: "all", todos, active: 2, completed: 1 });
  });
});

describe("loadTodos on a filter", () => {
  it("asks the API for the filtered list and for the counts of every todo", async () => {
    const { api, asked } = routed({
      "/todos?completed=false": async () => Response.json({ ok: true, data: [active] }),
      "/todos/counts": async () => Response.json({ ok: true, data: counts }),
    });

    const page = await loadTodos(api, "active");

    expect(page).toEqual({ state: "list", filter: "active", todos: [active], active: 1, completed: 3 });
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

    expect(await thrown(loadTodos(api, "active"))).toEqual({ status: 500 });
  });

  it("fails as a whole when the counts fail, though the list did not", async () => {
    const { api } = routed({
      "/todos?completed=true": async () => Response.json({ ok: true, data: [] }),
      "/todos/counts": internal,
    });

    expect(await thrown(loadTodos(api, "completed"))).toEqual({ status: 500 });
  });

  it("is signed_out when both reads are refused as unauthenticated", async () => {
    const { api } = routed({ "/todos?completed=false": anonymous, "/todos/counts": anonymous });

    expect(await loadTodos(api, "active")).toEqual({ state: "signed_out" });
  });

  it("fails, and is not signed_out, when one read is unauthenticated and the other failed", async () => {
    const { api } = routed({ "/todos?completed=false": anonymous, "/todos/counts": internal });

    expect(await thrown(loadTodos(api, "active"))).toEqual({ status: 500 });
  });
});
