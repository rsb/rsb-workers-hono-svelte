import { describe, expect, it } from "vitest";
import { clearCompletedTodos } from "../../../src/lib/server/todos/clear-completed-todos.ts";
import { SOMETHING_WENT_WRONG } from "../../../src/lib/server/todos/messages.ts";

const binding = (reply: () => Promise<Response>) => ({ fetch: reply });

const failure = (kind: string, status: number) =>
  binding(async () => Response.json({ ok: false, error: { kind, message: "for developers" } }, { status }));

describe("clearCompletedTodos", () => {
  it("answers 500 and says something went wrong when the API fails", async () => {
    const result = await clearCompletedTodos(failure("internal", 500));
    expect(result).toMatchObject({ status: 500, data: { clearCompleted: { message: SOMETHING_WENT_WRONG } } });
  });

  it("answers 500 and says something went wrong when the API cannot be reached", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    const result = await clearCompletedTodos(api);
    expect(result).toMatchObject({ status: 500, data: { clearCompleted: { message: SOMETHING_WENT_WRONG } } });
  });

  it("passes the status of a refusal on, with the same message", async () => {
    const refused = binding(async () =>
      Response.json(
        { ok: false, error: { kind: "validation", message: "completed must be true", field: "completed" } },
        { status: 422 },
      ),
    );
    const result = await clearCompletedTodos(refused);
    expect(result).toMatchObject({ status: 422, data: { clearCompleted: { message: SOMETHING_WENT_WRONG } } });
  });

  it("asks for completed=true only, and says it cleared", async () => {
    const sent: string[] = [];
    const api = {
      fetch: async (url: string) => {
        sent.push(url);
        return Response.json({ ok: true, data: [] });
      },
    };

    expect(await clearCompletedTodos(api)).toEqual({ cleared: true });
    expect(sent).toEqual(["https://todo-api/todos?completed=true"]);
  });
});
