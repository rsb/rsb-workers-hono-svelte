import { DeletedReply, Failure, envelope } from "@todo/contract-api";
import { Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { notFound, unavailable, wrap } from "@todo/fail/fail.ts";
import { deleteTodo } from "../../../../../src/app/handlers/todos/delete-todo.ts";
import type { DeleteTodo } from "@todo/operations/todos/delete-todo.ts";

/** Sends a DELETE through one route, so the handler gets its `:id` as it would be served. */
const remove = (operation: DeleteTodo, id: string) => {
  const app = new Hono().delete("/todos/:id", deleteTodo(operation));
  return app.request(`/todos/${id}`, { method: "DELETE" });
};

/** Status and error of a failure reply. */
const failed = async (response: Response) => ({
  status: response.status,
  error: v.parse(Failure, await response.json()).error,
});

describe("deleteTodo", () => {
  it("deletes the todo the path names and presents its id", async () => {
    const asked: string[] = [];
    const operation: DeleteTodo = async (id) => {
      asked.push(id);
      return ok(id);
    };

    const response = await remove(operation, "id-1");

    expect(response.status).toBe(200);
    expect(v.parse(envelope(DeletedReply), await response.json())).toEqual({ ok: true, data: { id: "id-1" } });
    expect(asked).toEqual(["id-1"]);
  });

  it("answers not_found when no todo has the id", async () => {
    const missing = wrap(notFound("no todo has id id-9"), "delete todo");

    const response = await remove(async () => err(missing), "id-9");

    expect(await failed(response)).toEqual({
      status: 404,
      error: { kind: "not_found", message: "no todo has id id-9" },
    });
  });

  it("answers internal when the store cannot answer, without the cause", async () => {
    // Silences the log; the test does not assert on it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = wrap(unavailable("delete todo: D1_ERROR: Network connection lost."), "delete todo");

    const response = await remove(async () => err(down), "id-1");
    const text = await response.clone().text();

    expect(await failed(response)).toEqual({
      status: 500,
      error: { kind: "internal", message: "internal error" },
    });
    expect(text).not.toContain("D1_ERROR");
  });
});
