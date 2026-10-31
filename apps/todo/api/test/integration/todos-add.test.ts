import { TodoReply, envelope } from "@todo/contract";
import { exports } from "cloudflare:workers";
import * as v from "valibot";
import { expect, it } from "vitest";

it("POST /todos adds an active todo with a trimmed title and a uuid", async () => {
  const response = await exports.default.fetch("https://todo-api/todos", {
    method: "POST",
    body: JSON.stringify({ title: "  buy milk  " }),
  });

  expect(response.status).toBe(201);
  expect(v.parse(envelope(TodoReply), await response.json())).toEqual({
    ok: true,
    data: { id: expect.stringMatching(/^[0-9a-f-]{36}$/), title: "buy milk", completed: false },
  });
});
