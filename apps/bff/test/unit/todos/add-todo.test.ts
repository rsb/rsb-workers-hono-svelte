import { TITLE_MAX } from "@todo/contract-api";
import { describe, expect, it } from "vitest";
import { addTodo } from "../../../src/lib/server/todos/add-todo.ts";

const binding = (reply: () => Promise<Response>) => ({ fetch: reply });

/** A fake binding for the cases that must not reach the API. */
const unreached = binding(() => {
  throw new Error("the API was reached");
});

const form = (title: string) => {
  const data = new FormData();
  data.set("title", title);
  return data;
};

const failure = (kind: string, message: string) =>
  binding(async () => Response.json({ ok: false, error: { kind, message } }, { status: 409 }));

describe("addTodo", () => {
  it("rejects a title that is empty after trim", async () => {
    const result = await addTodo(unreached, form("   "));
    expect(result).toMatchObject({ status: 422, data: { title: "   ", message: "title is empty" } });
  });

  it("rejects a title over the limit without asking the API", async () => {
    const title = "x".repeat(TITLE_MAX + 1);
    const result = await addTodo(unreached, form(title));
    expect(result).toMatchObject({
      status: 422,
      data: { title, message: "title is longer than 256 characters" },
    });
  });

  it("answers 409 when the API says the list is full", async () => {
    const result = await addTodo(failure("limit", "the list is full"), form("buy milk"));
    expect(result).toMatchObject({ status: 409, data: { message: "the list is full" } });
  });

  it("answers 500 when the API cannot be read", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    const result = await addTodo(api, form("buy milk"));
    expect(result).toMatchObject({ status: 500, data: { message: "the API could not be reached" } });
  });

  it("sends the trimmed title and presents what was added", async () => {
    let sent: unknown;
    const api = {
      fetch: async (_url: string, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return Response.json({ ok: true, data: { id: "id-1", title: "buy milk", completed: false } });
      },
    };
    expect(await addTodo(api, form("  buy milk  "))).toEqual({ added: "buy milk" });
    expect(sent).toEqual({ title: "buy milk" });
  });
});
