import { Failure, TodoReply, envelope } from "@todo/contract-api";
import { Context } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { limitReached, unavailable, wrap } from "@todo/fail/fail.ts";
import { postTodos } from "../../../../../src/app/handlers/todos/post-todos.ts";
import type { AddTodo } from "@todo/operations/todos/add-todo.ts";
import { toNewTodo } from "@todo/valid/todos/new-todo.ts";

const post = (body: string) =>
  new Context(new Request("https://todo-api/todos", { method: "POST", body }));

/** A fake operation for the cases that must not reach it. */
const unreached: AddTodo = async () => {
  throw new Error("addTodo was reached");
};

/** Status and error of a failure reply. */
const failed = async (response: Response) => ({
  status: response.status,
  error: v.parse(Failure, await response.json()).error,
});

describe("postTodos", () => {
  it("rejects a body that is not JSON", async () => {
    const response = await postTodos(unreached, toNewTodo)(post("title=buy milk"));

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "body", message: "body is not JSON" },
    });
  });

  it("rejects an unknown field, naming it", async () => {
    const response = await postTodos(unreached, toNewTodo)(post('{"title":"buy milk","done":true}'));
    const { status, error } = await failed(response);

    expect(status).toBe(422);
    expect(error).toMatchObject({ kind: "validation", field: "done" });
  });

  it("rejects a title that is empty after trim", async () => {
    const response = await postTodos(unreached, toNewTodo)(post('{"title":"   "}'));

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "title", message: "title is empty" },
    });
  });

  it("rejects a title over the limit", async () => {
    const title = "x".repeat(257);
    const response = await postTodos(unreached, toNewTodo)(post(JSON.stringify({ title })));

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "title", message: "title is longer than 256 characters" },
    });
  });

  it("answers limit when the list is full", async () => {
    const full = wrap(limitReached("the list is full"), "add todo");
    const response = await postTodos(async () => err(full), toNewTodo)(post('{"title":"buy milk"}'));

    expect(await failed(response)).toEqual({
      status: 409,
      error: { kind: "limit", message: "the list is full" },
    });
  });

  it("answers internal when the store cannot answer, without the cause", async () => {
    // Silences the log; the test does not assert on it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = wrap(unavailable("add unless full: D1_ERROR: Network connection lost."), "add todo");
    const response = await postTodos(async () => err(down), toNewTodo)(post('{"title":"buy milk"}'));
    const text = await response.clone().text();

    expect(await failed(response)).toEqual({
      status: 500,
      error: { kind: "internal", message: "internal error" },
    });
    expect(text).not.toContain("D1_ERROR");
  });

  it("adds the trimmed title and presents the todo", async () => {
    const add: AddTodo = async (input) => ok({ id: "id-1", title: input.title, completed: false });
    const response = await postTodos(add, toNewTodo)(post('{"title":"  buy milk  "}'));

    expect(response.status).toBe(201);
    expect(v.parse(envelope(TodoReply), await response.json())).toEqual({
      ok: true,
      data: { id: "id-1", title: "buy milk", completed: false },
    });
  });
});
