import { describe, expect, it } from "vitest";
import { Fail, invalid, limitReached, notFound, rootOf, unavailable, wrap } from "../../src/fail.ts";

describe("wrap", () => {
  it("adds context to the message and keeps the kind", () => {
    const root = limitReached("the list is full");

    const wrapped = wrap(wrap(root, "add unless full"), "add todo");

    expect(wrapped).toBeInstanceOf(Fail);
    expect(wrapped.kind).toBe("limit");
    expect(wrapped.message).toBe("add todo: add unless full: the list is full");
  });

  it("keeps the field an invalid failure names", () => {
    const wrapped = wrap(invalid("title", "title is empty"), "validate");

    expect(wrapped.field).toBe("title");
  });

  it("points back to what it wraps", () => {
    const root = unavailable("D1 is down");

    expect(wrap(root, "list todos").cause).toBe(root);
  });
});

describe("rootOf", () => {
  it("finds the failure that was first named", () => {
    const root = limitReached("the list is full");

    expect(rootOf(wrap(wrap(root, "store"), "operation"))).toBe(root);
  });

  it("stops at a cause that is not a failure", () => {
    const d1 = new Error("D1_ERROR: Network connection lost.");
    const root = unavailable("add unless full", d1);

    expect(rootOf(wrap(root, "add todo"))).toBe(root);
  });

  it("stops at a cause of another kind, so a server message never reaches the user", () => {
    const down = unavailable("select todos: D1_ERROR: Network connection lost.");
    const root = notFound("no such todo", down);

    expect(rootOf(wrap(root, "get todo"))).toBe(root);
  });
});
