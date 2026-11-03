import { TITLE_MAX } from "@todo/business/todos/todo.ts";
import { describe, expect, it } from "vitest";
import { addTodo } from "../../../src/lib/server/todos/add-todo.ts";
import {
  LIST_FULL,
  SOMETHING_WENT_WRONG,
  TITLE_RULE,
} from "../../../src/lib/server/todos/messages.ts";

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

const failure = (kind: string, status: number) =>
  binding(async () => Response.json({ ok: false, error: { kind, message: "for developers" } }, { status }));

describe("addTodo", () => {
  it("rejects a title that is empty after trim", async () => {
    const result = await addTodo(unreached, form("   "));
    expect(result).toMatchObject({ status: 422, data: { title: "   ", message: TITLE_RULE } });
  });

  it("rejects a title over the limit without asking the API", async () => {
    const title = "x".repeat(TITLE_MAX + 1);
    const result = await addTodo(unreached, form(title));
    expect(result).toMatchObject({
      status: 422,
      data: { title, message: TITLE_RULE },
    });
  });

  it("answers 409 and says the list is full when the API says so", async () => {
    const result = await addTodo(failure("limit", 409), form("buy milk"));
    expect(result).toMatchObject({ status: 409, data: { title: "buy milk", message: LIST_FULL } });
  });

  it("answers 500, keeps what was typed and says something went wrong when the API fails", async () => {
    const result = await addTodo(failure("internal", 500), form("buy milk"));
    expect(result).toMatchObject({
      status: 500,
      data: { title: "buy milk", message: SOMETHING_WENT_WRONG },
    });
  });

  it("answers 413 and says something went wrong when the API says the body is too large", async () => {
    const result = await addTodo(failure("too_large", 413), form("buy milk"));
    expect(result).toMatchObject({ status: 413, data: { message: SOMETHING_WENT_WRONG } });
  });

  it("answers 500 and says something went wrong when the API cannot be reached", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    const result = await addTodo(api, form("buy milk"));
    expect(result).toMatchObject({
      status: 500,
      data: { title: "buy milk", message: SOMETHING_WENT_WRONG },
    });
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
