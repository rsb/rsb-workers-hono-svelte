import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { AddTodoBody, TITLE_MAX } from "../../src/index.ts";

/** The issue a body fails with: its first path key and its message. */
const issue = (body: unknown) => {
  const result = v.safeParse(AddTodoBody, body);
  if (result.success) return undefined;
  const [first] = result.issues;
  return { field: first.path?.[0]?.key, message: first.message };
};

describe("AddTodoBody", () => {
  it("rejects a title that is not text", () => {
    expect(issue({ title: 3 })).toEqual({ field: "title", message: "title must be text" });
  });

  it("rejects a title that is empty after trim", () => {
    expect(issue({ title: "   " })).toEqual({ field: "title", message: "title is empty" });
  });

  it("rejects a title one over the limit", () => {
    expect(issue({ title: "x".repeat(TITLE_MAX + 1) })).toEqual({
      field: "title",
      message: "title is longer than 256 characters",
    });
  });

  it("rejects an unknown key", () => {
    expect(issue({ title: "buy milk", done: true })?.field).toBe("done");
  });

  it("accepts a title at the limit", () => {
    const title = "x".repeat(TITLE_MAX);
    expect(v.parse(AddTodoBody, { title })).toEqual({ title });
  });

  it("trims the title", () => {
    expect(v.parse(AddTodoBody, { title: "  buy milk  " })).toEqual({ title: "buy milk" });
  });
});
