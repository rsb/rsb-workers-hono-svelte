import { TodoReply, envelope } from "@todo/contract-api";
import * as v from "valibot";
import { expect, it } from "vitest";
import { asMember } from "./signed-in.ts";

it("POST /todos adds an active todo with a trimmed title and a uuid", async () => {
  const response = await asMember("https://todo-api/todos", {
    method: "POST",
    body: JSON.stringify({ title: "  buy milk  " }),
  });

  expect(response.status).toBe(201);
  expect(v.parse(envelope(TodoReply), await response.json())).toEqual({
    ok: true,
    data: { id: expect.stringMatching(/^[0-9a-f-]{36}$/), title: "buy milk", completed: false },
  });
});
