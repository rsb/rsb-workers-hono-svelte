import { describe, expect, it } from "vitest";
import { deleteTodos, getTodos, patchTodo, patchTodos, postTodo } from "../../../src/lib/server/api/todos.ts";

/** A fake binding that answers every call with `reply`. */
const binding = (reply: () => Promise<Response>) => ({ fetch: reply });

const unreadable = {
  ok: false,
  error: { kind: "internal", message: "the API could not be reached" },
};
const todo = { id: "id-1", title: "buy milk", completed: false };

describe("the API client", () => {
  it("is internal when the binding call fails", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    expect(await getTodos(api)).toEqual(unreadable);
  });

  it("is internal when the body is not JSON", async () => {
    const api = binding(async () => new Response("<html>"));
    expect(await getTodos(api)).toEqual(unreadable);
  });

  it("is internal when the body is not the envelope for the reply", async () => {
    const api = binding(async () => Response.json({ ok: true, data: [{ id: 1 }] }));
    expect(await getTodos(api)).toEqual(unreadable);
  });

  it("returns a failure as the API sent it, whatever the status", async () => {
    const failure = { ok: false, error: { kind: "limit", message: "the list is full" } };
    const api = binding(async () => Response.json(failure, { status: 200 }));
    expect(await postTodo(api, { title: "buy milk" })).toEqual(failure);
  });

  it("lists the todos", async () => {
    const api = binding(async () => Response.json({ ok: true, data: [todo] }));
    expect(await getTodos(api)).toEqual({ ok: true, data: [todo] });
  });

  it("returns the added todo", async () => {
    const api = binding(async () => Response.json({ ok: true, data: todo }, { status: 201 }));
    expect(await postTodo(api, { title: "buy milk" })).toEqual({ ok: true, data: todo });
  });

  it("sends the toggle to the todo's path, encoded, and returns the todo", async () => {
    const sent: { url: string; method: string | undefined; body: unknown }[] = [];
    const api = {
      fetch: async (url: string, init?: RequestInit) => {
        sent.push({ url, method: init?.method, body: JSON.parse(String(init?.body)) });
        return Response.json({ ok: true, data: { ...todo, completed: true } });
      },
    };

    expect(await patchTodo(api, "id 1/2", { completed: true })).toEqual({
      ok: true,
      data: { ...todo, completed: true },
    });
    expect(sent).toEqual([
      { url: "https://todo-api/todos/id%201%2F2", method: "PATCH", body: { completed: true } },
    ]);
  });

  it("sends mark all to the list's path and returns every todo", async () => {
    const sent: { url: string; method: string | undefined; body: unknown }[] = [];
    const api = {
      fetch: async (url: string, init?: RequestInit) => {
        sent.push({ url, method: init?.method, body: JSON.parse(String(init?.body)) });
        return Response.json({ ok: true, data: [{ ...todo, completed: true }] });
      },
    };

    expect(await patchTodos(api, { completed: true })).toEqual({
      ok: true,
      data: [{ ...todo, completed: true }],
    });
    expect(sent).toEqual([{ url: "https://todo-api/todos", method: "PATCH", body: { completed: true } }]);
  });

  it("sends clear completed to the list's path with completed=true and returns the todos left", async () => {
    const sent: { url: string; method: string | undefined }[] = [];
    const api = {
      fetch: async (url: string, init?: RequestInit) => {
        sent.push({ url, method: init?.method });
        return Response.json({ ok: true, data: [todo] });
      },
    };

    expect(await deleteTodos(api, { completed: "true" })).toEqual({ ok: true, data: [todo] });
    expect(sent).toEqual([{ url: "https://todo-api/todos?completed=true", method: "DELETE" }]);
  });
});
