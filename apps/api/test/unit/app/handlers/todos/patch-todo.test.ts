import { Failure, TodoReply, envelope } from "@todo/contract-api";
import { Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { notFound, unavailable, wrap } from "@todo/fail/fail.ts";
import { patchTodo } from "../../../../../src/app/handlers/todos/patch-todo.ts";
import type { ToggleTodo } from "@todo/operations/todos/toggle-todo.ts";

/** Sends a PATCH through one route, so the handler gets its `:id` as it would be served. */
const patch = (toggleTodo: ToggleTodo, id: string, body: string) => {
  const app = new Hono().patch("/todos/:id", patchTodo(toggleTodo));
  return app.request(`/todos/${id}`, { method: "PATCH", body });
};

/** A fake operation for the cases that must not reach it. */
const unreached: ToggleTodo = async () => {
  throw new Error("toggleTodo was reached");
};

/** Status and error of a failure reply. */
const failed = async (response: Response) => ({
  status: response.status,
  error: v.parse(Failure, await response.json()).error,
});

describe("patchTodo", () => {
  it("rejects a body that is not JSON", async () => {
    const response = await patch(unreached, "id-1", "completed=true");

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "body", message: "body is not JSON" },
    });
  });

  it("rejects completed that is not a boolean", async () => {
    const response = await patch(unreached, "id-1", '{"completed":"yes"}');

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "completed", message: "completed must be true or false" },
    });
  });

  it("rejects a title, which editing will accept with slice 4", async () => {
    const response = await patch(unreached, "id-1", '{"completed":true,"title":"buy milk"}');
    const { status, error } = await failed(response);

    expect(status).toBe(422);
    expect(error).toMatchObject({ kind: "validation", field: "title" });
  });

  it("answers not_found when no todo has the id", async () => {
    const missing = wrap(notFound("no todo has id id-9"), "toggle todo");
    const response = await patch(async () => err(missing), "id-9", '{"completed":true}');

    expect(await failed(response)).toEqual({
      status: 404,
      error: { kind: "not_found", message: "no todo has id id-9" },
    });
  });

  it("answers internal when the store cannot answer, without the cause", async () => {
    // Silences the log; the test does not assert on it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = wrap(unavailable("update todo completed: D1_ERROR: Network connection lost."), "toggle todo");
    const response = await patch(async () => err(down), "id-1", '{"completed":true}');
    const text = await response.clone().text();

    expect(await failed(response)).toEqual({
      status: 500,
      error: { kind: "internal", message: "internal error" },
    });
    expect(text).not.toContain("D1_ERROR");
  });

  it("toggles the todo the path names and presents it", async () => {
    const asked: { id: string; completed: boolean }[] = [];
    const toggle: ToggleTodo = async (id, completed) => {
      asked.push({ id, completed });
      return ok({ id, title: "buy milk", completed });
    };

    const response = await patch(toggle, "id-1", '{"completed":true}');

    expect(response.status).toBe(200);
    expect(v.parse(envelope(TodoReply), await response.json())).toEqual({
      ok: true,
      data: { id: "id-1", title: "buy milk", completed: true },
    });
    expect(asked).toEqual([{ id: "id-1", completed: true }]);
  });
});
