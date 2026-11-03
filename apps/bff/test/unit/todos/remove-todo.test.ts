import { describe, expect, it } from "vitest";
import { SOMETHING_WENT_WRONG } from "../../../src/lib/server/todos/messages.ts";
import { removeTodo } from "../../../src/lib/server/todos/remove-todo.ts";

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

describe("removeTodo", () => {
  it("answers 422 without asking the API when the id is missing", async () => {
    const result = await removeTodo(unreached, form({}));
    expect(result).toMatchObject({ status: 422, data: { remove: { id: "", message: SOMETHING_WENT_WRONG } } });
  });

  it("sends a DELETE for the todo and names the todo removed", async () => {
    const sent: { url: string; method: string | undefined }[] = [];
    const api = {
      fetch: async (url: string, init?: RequestInit) => {
        sent.push({ url, method: init?.method });
        return Response.json({ ok: true, data: { id: "id 1" } });
      },
    };

    expect(await removeTodo(api, form({ id: "id 1" }))).toEqual({ removed: "id 1" });
    expect(sent).toEqual([{ url: "https://todo-api/todos/id%201", method: "DELETE" }]);
  });

  it("counts a todo that is already gone as removed", async () => {
    const result = await removeTodo(failure("not_found", 404), form({ id: "id-1" }));
    expect(result).toEqual({ removed: "id-1" });
  });

  it("answers 500 and says something went wrong when the API fails", async () => {
    const result = await removeTodo(failure("internal", 500), form({ id: "id-1" }));
    expect(result).toMatchObject({ status: 500, data: { remove: { id: "id-1", message: SOMETHING_WENT_WRONG } } });
  });

  it("answers 500 and says something went wrong when the API cannot be reached", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    const result = await removeTodo(api, form({ id: "id-1" }));
    expect(result).toMatchObject({ status: 500, data: { remove: { id: "id-1", message: SOMETHING_WENT_WRONG } } });
  });
});
