import { describe, expect, it } from "vitest";
import { getTodos, postTodo } from "../../../src/lib/server/api/todos.ts";

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
});
