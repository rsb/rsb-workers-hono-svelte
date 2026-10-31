import { Failure } from "@todo/contract-api";
import { exports } from "cloudflare:workers";
import * as v from "valibot";
import { expect, it } from "vitest";

const add = (title: string) =>
  exports.default.fetch("https://todo-api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });

// The cap is not imported from the api: integration sees only the wire, and
// the PRD's number (deviation 9) is what is being proven.
it("the 501st todo is rejected with limit", async () => {
  for (let n = 1; n <= 500; n++) expect((await add(`todo ${n}`)).status).toBe(201);

  const response = await add("one too many");

  expect(response.status).toBe(409);
  expect(v.parse(Failure, await response.json()).error.kind).toBe("limit");
});
