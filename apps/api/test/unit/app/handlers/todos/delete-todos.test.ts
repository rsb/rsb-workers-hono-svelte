import { Failure, TodoListReply, envelope } from "@todo/contract-api";
import { Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { unavailable, wrap } from "@todo/fail/fail.ts";
import { deleteTodos } from "../../../../../src/app/handlers/todos/delete-todos.ts";
import type { DeleteCompleted } from "@todo/operations/todos/delete-completed.ts";
import { asMember, member } from "../actor.ts";

/** Sends a DELETE through the route, with the query given, as it would be served. */
const remove = (deleteCompleted: DeleteCompleted, query: string) => {
  const app = new Hono().use(asMember).delete("/todos", deleteTodos(deleteCompleted));
  return app.request(`/todos${query}`, { method: "DELETE" });
};

/** A fake operation for the cases that must not reach it. */
const unreached: DeleteCompleted = async () => {
  throw new Error("deleteCompleted was reached");
};

/** Status and error of a failure reply. */
const failed = async (response: Response) => ({
  status: response.status,
  error: v.parse(Failure, await response.json()).error,
});

describe("deleteTodos", () => {
  // No query is never "delete all".
  it("rejects a request without completed, naming the field", async () => {
    const response = await remove(unreached, "");

    expect(await failed(response)).toMatchObject({ status: 422, error: { kind: "validation", field: "completed" } });
  });

  it("rejects completed=false", async () => {
    const response = await remove(unreached, "?completed=false");

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "completed", message: "completed must be true" },
    });
  });

  it("rejects completed given twice, rather than reading the first", async () => {
    const response = await remove(unreached, "?completed=true&completed=false");

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "completed", message: "completed must be given once" },
    });
  });

  it("rejects an unknown key", async () => {
    const response = await remove(unreached, "?completed=true&id=id-1");

    expect(await failed(response)).toMatchObject({ status: 422, error: { kind: "validation", field: "id" } });
  });

  it("deletes the completed todos and presents the list the operation returns", async () => {
    const asked: unknown[] = [];
    const todos = [{ id: "id-2", title: "walk dog", completed: false }];
    const deleteCompleted: DeleteCompleted = async (actor) => {
      asked.push(actor);
      return ok(todos);
    };

    const response = await remove(deleteCompleted, "?completed=true");

    expect(asked).toEqual([member]);
    expect(response.status).toBe(200);
    expect(v.parse(envelope(TodoListReply), await response.json())).toEqual({ ok: true, data: todos });
  });

  it("answers internal when the store fails", async () => {
    // Silences the log; the test does not assert on it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = wrap(unavailable("delete completed: D1_ERROR: Network connection lost."), "delete completed");

    const response = await remove(async () => err(down), "?completed=true");

    expect(await failed(response)).toEqual({
      status: 500,
      error: { kind: "internal", message: "internal error" },
    });
  });
});
