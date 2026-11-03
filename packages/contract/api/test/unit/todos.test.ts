import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { AddTodoBody, ToggleTodoBody } from "../../src/index.ts";

/** The issue a body fails with: its first path key and its message. */
const issue = (body: unknown, schema: v.GenericSchema = AddTodoBody) => {
  const result = v.safeParse(schema, body);
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

describe("ToggleTodoBody", () => {
  it("rejects completed that is not a boolean", () => {
    expect(issue({ completed: "true" }, ToggleTodoBody)).toEqual({
      field: "completed",
      message: "completed must be true or false",
    });
  });

  it("rejects a title until editing comes with slice 4", () => {
    expect(issue({ completed: true, title: "buy milk" }, ToggleTodoBody)?.field).toBe("title");
  });

  it("rejects a body without completed", () => {
    expect(issue({}, ToggleTodoBody)?.field).toBe("completed");
  });

  it("passes completed through", () => {
    expect(v.parse(ToggleTodoBody, { completed: false })).toEqual({ completed: false });
  });
});
