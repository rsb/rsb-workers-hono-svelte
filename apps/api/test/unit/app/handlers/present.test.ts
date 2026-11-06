import { Failure } from "@todo/contract-api";
import { forbidden } from "@todo/fail/fail.ts";
import { Context } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { userFailure } from "../../../../src/app/handlers/present.ts";

describe("userFailure, for forbidden", () => {
  it("gives a reason api.md lists", async () => {
    const c = new Context(new Request("https://todo-api/todos", { method: "POST" }));

    const response = userFailure(c, forbidden("channel", "the request does not come from the BFF's page"));

    expect(response.status).toBe(403);
    expect(v.parse(Failure, await response.json()).error).toEqual({
      kind: "forbidden",
      message: "the request does not come from the BFF's page",
      reason: "channel",
    });
  });

  it("answers internal, and logs, for a reason api.md does not list", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = new Context(new Request("https://todo-api/todos", { method: "POST" }));

    const response = userFailure(c, forbidden("unlisted", "refused"));

    expect(response.status).toBe(500);
    expect(v.parse(Failure, await response.json()).error).toEqual({ kind: "internal", message: "internal error" });
    expect(String(logged.mock.calls[0]?.[0])).toContain("forbidden gives the reason unlisted, which api.md does not list");
  });
});
