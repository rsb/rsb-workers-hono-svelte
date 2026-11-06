import { Failure, TodoReply, envelope } from "@todo/contract-api";
import { Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { notFound, unavailable, wrap } from "@todo/fail/fail.ts";
import { patchTodo } from "../../../../../src/app/handlers/todos/patch-todo.ts";
import type { TodoPatch } from "@todo/business/todos/todo.ts";
import type { UpdateTodo } from "@todo/operations/todos/update-todo.ts";
import { toTodoPatch } from "@todo/valid/todos/todo-patch.ts";
import { asMember, member } from "../actor.ts";

/** Sends a PATCH through one route, so the handler gets its `:id` as it would be served. */
const patch = (updateTodo: UpdateTodo, id: string, body: string) => {
  const app = new Hono().use(asMember).patch("/todos/:id", patchTodo(updateTodo, toTodoPatch));
  return app.request(`/todos/${id}`, { method: "PATCH", body });
};

/** A fake operation for the cases that must not reach it. */
const unreached: UpdateTodo = async () => {
  throw new Error("updateTodo was reached");
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

  it("rejects a body with neither title nor completed", async () => {
    const response = await patch(unreached, "id-1", "{}");

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "body", message: "body must have title, completed or both" },
    });
  });

  it("rejects a title that is empty after trim", async () => {
    const response = await patch(unreached, "id-1", '{"title":"   "}');

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "title", message: "title is empty" },
    });
  });

  it("rejects a title one over the limit", async () => {
    const body = JSON.stringify({ title: "x".repeat(257) });
    const response = await patch(unreached, "id-1", body);

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "title", message: "title is longer than 256 characters" },
    });
  });

  it("answers not_found when no todo has the id", async () => {
    const missing = wrap(notFound("no todo has id id-9"), "update todo");
    const response = await patch(async () => err(missing), "id-9", '{"completed":true}');

    expect(await failed(response)).toEqual({
      status: 404,
      error: { kind: "not_found", message: "no todo has id id-9" },
    });
  });

  it("answers internal when the store cannot answer, without the cause", async () => {
    // Silences the log; the test does not assert on it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = wrap(unavailable("update todo: D1_ERROR: Network connection lost."), "update todo");
    const response = await patch(async () => err(down), "id-1", '{"completed":true}');
    const text = await response.clone().text();

    expect(await failed(response)).toEqual({
      status: 500,
      error: { kind: "internal", message: "internal error" },
    });
    expect(text).not.toContain("D1_ERROR");
  });

  it("updates the todo the path names with completed, as the attached actor, and presents it", async () => {
    const asked: { actor: unknown; id: string; patch: TodoPatch }[] = [];
    const update: UpdateTodo = async (actor, id, patch) => {
      asked.push({ actor, id, patch });
      return ok({ id, title: "buy milk", completed: true });
    };

    const response = await patch(update, "id-1", '{"completed":true}');

    expect(response.status).toBe(200);
    expect(v.parse(envelope(TodoReply), await response.json())).toEqual({
      ok: true,
      data: { id: "id-1", title: "buy milk", completed: true },
    });
    expect(asked).toEqual([{ actor: member, id: "id-1", patch: { completed: true } }]);
  });

  it("passes the title on trimmed", async () => {
    const asked: TodoPatch[] = [];
    const update: UpdateTodo = async (_actor, id, patch) => {
      asked.push(patch);
      return ok({ id, title: "buy bread", completed: false });
    };

    const response = await patch(update, "id-1", '{"title":"  buy bread  "}');

    expect(response.status).toBe(200);
    expect(asked).toEqual([{ title: "buy bread" }]);
  });

  it("passes both fields on together", async () => {
    const asked: TodoPatch[] = [];
    const update: UpdateTodo = async (_actor, id, patch) => {
      asked.push(patch);
      return ok({ id, title: "buy bread", completed: true });
    };

    await patch(update, "id-1", '{"title":"buy bread","completed":true}');

    expect(asked).toEqual([{ title: "buy bread", completed: true }]);
  });
});
