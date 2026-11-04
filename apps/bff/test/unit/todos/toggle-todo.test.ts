import { describe, expect, it } from "vitest";
import { SOMETHING_WENT_WRONG } from "../../../src/lib/server/todos/messages.ts";
import { toggleTodo } from "../../../src/lib/server/todos/toggle-todo.ts";

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

describe("toggleTodo", () => {
  it("answers 422 without asking the API when the id is missing", async () => {
    const result = await toggleTodo(unreached, form({ completed: "true" }));
    expect(result).toMatchObject({ status: 422, data: { toggle: { id: "", message: SOMETHING_WENT_WRONG } } });
  });

  it("answers 422 without asking the API when completed is missing", async () => {
    const result = await toggleTodo(unreached, form({ id: "id-1" }));
    expect(result).toMatchObject({ status: 422, data: { toggle: { id: "id-1", message: SOMETHING_WENT_WRONG } } });
  });

  it("answers 422 without asking the API when completed is not true or false", async () => {
    const result = await toggleTodo(unreached, form({ id: "id-1", completed: "yes" }));
    expect(result).toMatchObject({ status: 422, data: { toggle: { id: "id-1", message: SOMETHING_WENT_WRONG } } });
  });

  it("answers 404 and says something went wrong when the todo is gone", async () => {
    const result = await toggleTodo(failure("not_found", 404), form({ id: "id-1", completed: "true" }));
    expect(result).toMatchObject({ status: 404, data: { toggle: { id: "id-1", message: SOMETHING_WENT_WRONG } } });
  });

  it("answers 500 and says something went wrong when the API cannot be reached", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    const result = await toggleTodo(api, form({ id: "id-1", completed: "true" }));
    expect(result).toMatchObject({ status: 500, data: { toggle: { id: "id-1", message: SOMETHING_WENT_WRONG } } });
  });

  it("sends the value the form asks for and names the todo toggled", async () => {
    const sent: unknown[] = [];
    const api = {
      fetch: async (_url: string, init?: RequestInit) => {
        sent.push(JSON.parse(String(init?.body)));
        return Response.json({ ok: true, data: { id: "id-1", title: "buy milk", completed: false } });
      },
    };

    expect(await toggleTodo(api, form({ id: "id-1", completed: "false" }))).toEqual({ toggled: "id-1" });
    expect(sent).toEqual([{ completed: false }]);
  });
});
