import { Failure, TodoCountsReply, envelope } from "@todo/contract-api";
import { err, ok } from "@todo/business/result.ts";
import { unavailable, wrap } from "@todo/fail/fail.ts";
import { Context } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { getTodoCounts } from "../../../../../src/app/handlers/todos/get-todo-counts.ts";

const get = () => new Context(new Request("https://todo-api/todos/counts"));

describe("getTodoCounts", () => {
  it("presents the counts the operation gives", async () => {
    const response = await getTodoCounts(async () => ok({ active: 2, completed: 1 }))(get());

    expect(response.status).toBe(200);
    expect(v.parse(envelope(TodoCountsReply), await response.json())).toEqual({
      ok: true,
      data: { active: 2, completed: 1 },
    });
  });

  it("answers internal when the store fails", async () => {
    // Silences the log; the test does not assert on it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = wrap(unavailable("count todos: D1_ERROR: Network connection lost."), "count todos");

    const response = await getTodoCounts(async () => err(down))(get());

    expect(response.status).toBe(500);
    expect(v.parse(Failure, await response.json()).error).toEqual({
      kind: "internal",
      message: "internal error",
    });
  });
});
