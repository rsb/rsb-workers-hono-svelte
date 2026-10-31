import { HealthReply, envelope } from "@todo/contract";
import { exports } from "cloudflare:workers";
import * as v from "valibot";
import { expect, it } from "vitest";

it("GET /health returns ok", async () => {
  const response = await exports.default.fetch("https://todo-api/health");

  expect(response.status).toBe(200);
  expect(v.parse(envelope(HealthReply), await response.json())).toEqual({
    ok: true,
    data: { ok: true },
  });
});
