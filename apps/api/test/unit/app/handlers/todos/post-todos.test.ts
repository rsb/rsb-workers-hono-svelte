import { Failure, TITLE_MAX, TodoReply, envelope } from "@todo/contract-api";
import { Context } from "hono";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { err, ok } from "@todo/business/result.ts";
import { postTodos } from "../../../../../src/app/handlers/todos/post-todos.ts";
import type { AddTodo } from "@todo/operations/todos/add-todo.ts";

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
    const response = await postTodos(unreached)(post("title=buy milk"));

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "body", message: "body is not JSON" },
    });
  });

  it("rejects an unknown field, naming it", async () => {
    const response = await postTodos(unreached)(post('{"title":"buy milk","done":true}'));
    const { status, error } = await failed(response);

    expect(status).toBe(422);
    expect(error).toMatchObject({ kind: "validation", field: "done" });
  });

  it("rejects a title over the limit", async () => {
    const title = "x".repeat(TITLE_MAX + 1);
    const response = await postTodos(unreached)(post(JSON.stringify({ title })));

    expect(await failed(response)).toEqual({
      status: 422,
      error: { kind: "validation", field: "title", message: "title is longer than 256 characters" },
    });
  });

  it("answers limit when the list is full", async () => {
    const response = await postTodos(async () => err({ kind: "full" }))(post('{"title":"buy milk"}'));

    expect(await failed(response)).toEqual({
      status: 409,
      error: { kind: "limit", message: "the list is full" },
    });
  });

  it("adds the trimmed title and presents the todo", async () => {
    const add: AddTodo = async (title) => ok({ id: "id-1", title, completed: false });
    const response = await postTodos(add)(post('{"title":"  buy milk  "}'));

    expect(response.status).toBe(201);
    expect(v.parse(envelope(TodoReply), await response.json())).toEqual({
      ok: true,
      data: { id: "id-1", title: "buy milk", completed: false },
    });
  });
});
