import { Failure } from "@todo/contract-api";
import * as v from "valibot";
import { expect, it } from "vitest";
import { ADMIN, asMember, fetchAs } from "./signed-in.ts";

const add = (title: string) =>
  asMember("https://todo-api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });

// The cap is not imported from the api: integration sees only the wire, and
// the PRD's number (deviation 9) is what is being proven.
it("todos.cap: the 501st todo is rejected with limit, and only for its owner", async () => {
  for (let n = 1; n <= 500; n++) expect((await add(`todo ${n}`)).status).toBe(201);

  const response = await add("one too many");

  expect(response.status).toBe(409);
  expect(v.parse(Failure, await response.json()).error.kind).toBe("limit");

  // The cap is the owner's: another user's list is not full.
  const theirs = await fetchAs(ADMIN, "https://todo-api/todos", { method: "POST", body: '{"title":"mine"}' });
  expect(theirs.status).toBe(201);
  // 500 adds, each now one identity lookup more (the session), run past
  // vitest's 5 s default.
}, 30_000);
