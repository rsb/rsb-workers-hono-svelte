import { Failure, TodoListReply, envelope } from "@todo/contract-api";
import { err, ok } from "@todo/business/result.ts";
import type { TodoFilter } from "@todo/business/todos/todo.ts";
import { serverFault, wrap } from "@todo/fail/fail.ts";
import { Context, Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import type { ListTodos } from "@todo/operations/todos/list-todos.ts";
import { getTodos } from "../../../../../src/app/handlers/todos/get-todos.ts";

const get = () => new Context(new Request("https://todo-api/todos"));

/** Sends a GET through the route, with the query given, as it would be served. */
const list = (listTodos: ListTodos, query: string) => {
  const app = new Hono().get("/todos", getTodos(listTodos));
  return app.request(`/todos${query}`);
};

/** A fake operation that records the filter it was asked for. */
const recording = () => {
  const asked: TodoFilter[] = [];
  const listTodos: ListTodos = async (filter) => {
    asked.push(filter);
    return ok([]);
  };
  return { asked, listTodos };
};

/** A fake operation for the cases that must not reach it. */
const unreached: ListTodos = async () => {
  throw new Error("listTodos was reached");
};

/** Status and error of a failure reply. */
const failed = async (response: Response) => ({
  status: response.status,
  error: v.parse(Failure, await response.json()).error,
});

describe("getTodos, the query", () => {
  it("asks for every todo when there is no query", async () => {
    const { asked, listTodos } = recording();

    await list(listTodos, "");

    expect(asked).toEqual([{}]);
  });

  // `?` with nothing after it has no keys, so it is no query.
  it("reads an empty query as no query", async () => {
    const { asked, listTodos } = recording();

    await list(listTodos, "?");

    expect(asked).toEqual([{}]);
  });

  it("turns completed=true and completed=false into booleans", async () => {
    const { asked, listTodos } = recording();

    await list(listTodos, "?completed=true");
    await list(listTodos, "?completed=false");

    expect(asked).toEqual([{ completed: true }, { completed: false }]);
  });

  it("rejects completed that is not true or false", async () => {
    const response = await list(unreached, "?completed=yes");

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "completed", message: "completed must be true or false" },
    });
  });

  it("rejects an empty completed, rather than reading it as no filter", async () => {
    const response = await list(unreached, "?completed=");

    expect(await failed(response)).toMatchObject({ status: 422, error: { field: "completed" } });
  });

  it("rejects completed given twice", async () => {
    const response = await list(unreached, "?completed=true&completed=false");

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "completed", message: "completed must be given once" },
    });
  });

  it("rejects an unknown key", async () => {
    const response = await list(unreached, "?done=true");

    expect(await failed(response)).toMatchObject({ status: 422, error: { kind: "validation", field: "done" } });
  });
});

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
