import { Failure, TodoListReply, envelope } from "@todo/contract-api";
import { Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { unavailable, wrap } from "@todo/fail/fail.ts";
import { patchTodos } from "../../../../../src/app/handlers/todos/patch-todos.ts";
import type { SetAllCompleted } from "@todo/operations/todos/set-all-completed.ts";

/** Sends a PATCH through the route, as it would be served. */
const patch = (setAllCompleted: SetAllCompleted, body: string) => {
  const app = new Hono().patch("/todos", patchTodos(setAllCompleted));
  return app.request("/todos", { method: "PATCH", body });
};

/** A fake operation for the cases that must not reach it. */
const unreached: SetAllCompleted = async () => {
  throw new Error("setAllCompleted was reached");
};

/** Status and error of a failure reply. */
const failed = async (response: Response) => ({
  status: response.status,
  error: v.parse(Failure, await response.json()).error,
});

describe("patchTodos", () => {
  it("rejects a body that is not JSON", async () => {
    const response = await patch(unreached, "completed=true");

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "body", message: "body is not JSON" },
    });
  });

  it("rejects completed that is not a boolean", async () => {
    const response = await patch(unreached, '{"completed":"true"}');

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "completed", message: "completed must be true or false" },
    });
  });

  it("rejects a body without completed, naming the field", async () => {
    const response = await patch(unreached, "{}");

    expect(await failed(response)).toMatchObject({ status: 422, error: { kind: "validation", field: "completed" } });
  });

  it("rejects an unknown key", async () => {
    const response = await patch(unreached, '{"completed":true,"title":"buy milk"}');

    expect(await failed(response)).toMatchObject({ status: 422, error: { kind: "validation", field: "title" } });
  });

  it("sets the value sent and presents the list the operation returns", async () => {
    const asked: boolean[] = [];
    const todos = [
      { id: "id-1", title: "buy milk", completed: true },
      { id: "id-2", title: "walk dog", completed: true },
    ];
    const setAllCompleted: SetAllCompleted = async (completed) => {
      asked.push(completed);
      return ok(todos);
    };

    const response = await patch(setAllCompleted, '{"completed":true}');

    expect(asked).toEqual([true]);
    expect(response.status).toBe(200);
    expect(v.parse(envelope(TodoListReply), await response.json())).toEqual({ ok: true, data: todos });
  });

  it("answers internal when the store fails", async () => {
    // Silences the log; the test does not assert on it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = wrap(unavailable("set all completed: D1_ERROR: Network connection lost."), "set all completed");

    const response = await patch(async () => err(down), '{"completed":true}');

    expect(await failed(response)).toEqual({
      status: 500,
      error: { kind: "internal", message: "internal error" },
    });
  });
});
