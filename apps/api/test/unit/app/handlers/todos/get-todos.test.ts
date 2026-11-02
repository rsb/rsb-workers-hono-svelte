import { Failure, TodoListReply, envelope } from "@todo/contract-api";
import { err, ok } from "@todo/business/result.ts";
import { serverFault, wrap } from "@todo/fail/fail.ts";
import { Context } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { getTodos } from "../../../../../src/app/handlers/todos/get-todos.ts";

const get = () => new Context(new Request("https://todo-api/todos"));

describe("getTodos", () => {
  it("presents every todo the operation lists", async () => {
    const todos = [
      { id: "id-1", title: "buy milk", completed: false },
      { id: "id-2", title: "walk dog", completed: true },
    ];

    const response = await getTodos(async () => ok(todos))(get());

    expect(response.status).toBe(200);
    expect(v.parse(envelope(TodoListReply), await response.json())).toEqual({ ok: true, data: todos });
  });

  it("answers internal when the store fails", async () => {
    // Silences the log; the test does not assert on it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = wrap(serverFault("select todos: D1_ERROR: no such table: todos"), "list todos");

    const response = await getTodos(async () => err(broken))(get());

    expect(response.status).toBe(500);
    expect(v.parse(Failure, await response.json()).error).toEqual({
      kind: "internal",
      message: "internal error",
    });
  });
});
