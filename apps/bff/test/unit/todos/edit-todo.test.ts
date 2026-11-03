import { describe, expect, it } from "vitest";
import { SOMETHING_WENT_WRONG, TITLE_RULE } from "../../../src/lib/server/todos/messages.ts";
import { editTodo } from "../../../src/lib/server/todos/edit-todo.ts";

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

describe("editTodo", () => {
  it("answers 422 without asking the API when the id is missing", async () => {
    const result = await editTodo(unreached, form({ title: "buy bread" }));

    expect(result).toMatchObject({
      status: 422,
      data: { edit: { id: "", title: "buy bread", message: SOMETHING_WENT_WRONG } },
    });
  });

  it("leaves the todo as it is, without asking the API, when the title is empty after trim", async () => {
    const result = await editTodo(unreached, form({ id: "id-1", title: "   " }));

    expect(result).toEqual({ edited: "id-1" });
  });

  it("answers 422 with the title rule, keeping what was typed, when the title is too long", async () => {
    const title = "x".repeat(257);

    const result = await editTodo(unreached, form({ id: "id-1", title }));

    expect(result).toMatchObject({ status: 422, data: { edit: { id: "id-1", title, message: TITLE_RULE } } });
  });

  it("answers 404 and says something went wrong when the todo is gone", async () => {
    const result = await editTodo(failure("not_found", 404), form({ id: "id-1", title: "buy bread" }));

    expect(result).toMatchObject({
      status: 404,
      data: { edit: { id: "id-1", title: "buy bread", message: SOMETHING_WENT_WRONG } },
    });
  });

  it("answers 500 and says something went wrong when the API cannot be reached", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));

    const result = await editTodo(api, form({ id: "id-1", title: "buy bread" }));

    expect(result).toMatchObject({ status: 500, data: { edit: { message: SOMETHING_WENT_WRONG } } });
  });

  it("sends the title trimmed and names the todo edited", async () => {
    const sent: unknown[] = [];
    const api = {
      fetch: async (_url: string, init?: RequestInit) => {
        sent.push(JSON.parse(String(init?.body)));
        return Response.json({ ok: true, data: { id: "id-1", title: "buy bread", completed: false } });
      },
    };

    expect(await editTodo(api, form({ id: "id-1", title: "  buy bread  " }))).toEqual({ edited: "id-1" });
    expect(sent).toEqual([{ title: "buy bread" }]);
  });
});
