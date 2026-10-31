import { Failure } from "@todo/contract";
import { Context } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { onError } from "../../../../../src/app/handlers/errors/errors.ts";

describe("onError", () => {
  it("returns internal without the cause", async () => {
    // Silences the log; the test does not assert on it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const c = new Context(new Request("https://todo-api/health"));

    const response = await onError(new Error("secret cause"), c);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(v.parse(Failure, JSON.parse(text)).error).toEqual({
      kind: "internal",
      message: "internal error",
    });
    expect(text).not.toContain("secret cause");
  });
});
