import { BODY_LIMIT_BYTES, Failure } from "@todo/contract";
import { exports } from "cloudflare:workers";
import * as v from "valibot";
import { expect, it } from "vitest";

it("a body over the limit returns too_large", async () => {
  const response = await exports.default.fetch("https://todo-api/health", {
    method: "POST",
    body: "x".repeat(BODY_LIMIT_BYTES + 1),
  });

  expect(response.status).toBe(413);
  expect(v.parse(Failure, await response.json()).error.kind).toBe("too_large");
});
