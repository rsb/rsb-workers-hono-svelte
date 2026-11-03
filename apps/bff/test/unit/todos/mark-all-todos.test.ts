import { describe, expect, it } from "vitest";
import { SOMETHING_WENT_WRONG } from "../../../src/lib/server/todos/messages.ts";
import { markAllTodos } from "../../../src/lib/server/todos/mark-all-todos.ts";

const binding = (reply: () => Promise<Response>) => ({ fetch: reply });

/** A fake binding for the cases that must not reach the API. */
const unreached = binding(() => {
  throw new Error("the API was reached");
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
};

const failure = (kind: string, status: number) =>
  binding(async () => Response.json({ ok: false, error: { kind, message: "for developers" } }, { status }));

describe("markAllTodos", () => {
  it("answers 422 without asking the API when completed is missing", async () => {
    const result = await markAllTodos(unreached, form({}));
    expect(result).toMatchObject({ status: 422, data: { markAll: { message: SOMETHING_WENT_WRONG } } });
  });

  it("answers 422 without asking the API when completed is not true or false", async () => {
    const result = await markAllTodos(unreached, form({ completed: "yes" }));
    expect(result).toMatchObject({ status: 422, data: { markAll: { message: SOMETHING_WENT_WRONG } } });
  });

  it("answers 500 and says something went wrong when the API fails", async () => {
    const result = await markAllTodos(failure("internal", 500), form({ completed: "true" }));
    expect(result).toMatchObject({ status: 500, data: { markAll: { message: SOMETHING_WENT_WRONG } } });
  });

  it("answers 500 and says something went wrong when the API cannot be reached", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    const result = await markAllTodos(api, form({ completed: "true" }));
    expect(result).toMatchObject({ status: 500, data: { markAll: { message: SOMETHING_WENT_WRONG } } });
  });

  it("sends the value the form asks for and names it", async () => {
    const sent: unknown[] = [];
    const api = {
      fetch: async (_url: string, init?: RequestInit) => {
        sent.push(JSON.parse(String(init?.body)));
        return Response.json({ ok: true, data: [{ id: "id-1", title: "buy milk", completed: false }] });
      },
    };

    expect(await markAllTodos(api, form({ completed: "false" }))).toEqual({ markedAll: false });
    expect(sent).toEqual([{ completed: false }]);
  });
});
