import { Failure } from "@todo/contract";
import { exports } from "cloudflare:workers";
import * as v from "valibot";
import { expect, it } from "vitest";

it("an unknown route returns not_found", async () => {
  const response = await exports.default.fetch("https://todo-api/nope");

  expect(response.status).toBe(404);
  expect(v.parse(Failure, await response.json()).error.kind).toBe("not_found");
});
