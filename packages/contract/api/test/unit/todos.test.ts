import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { AddTodoBody } from "../../src/index.ts";

/** The issue a body fails with: its first path key and its message. */
const issue = (body: unknown) => {
  const result = v.safeParse(AddTodoBody, body);
  if (result.success) {
    return undefined;
  }
  const [first] = result.issues;
  return { field: first.path?.[0]?.key, message: first.message };
};

// Only the shape is the contract's. The title's rules are tested with each handler.
describe("AddTodoBody", () => {
  it("rejects a title that is not text", () => {
    expect(issue({ title: 3 })).toEqual({ field: "title", message: "title must be text" });
  });

  it("rejects an unknown key", () => {
    expect(issue({ title: "buy milk", done: true })?.field).toBe("done");
  });

  it("passes the title through as sent, untrimmed", () => {
    expect(v.parse(AddTodoBody, { title: "  buy milk  " })).toEqual({ title: "  buy milk  " });
  });
});
