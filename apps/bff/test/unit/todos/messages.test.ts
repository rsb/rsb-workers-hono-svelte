import { describe, expect, it } from "vitest";
import { LIST_FULL, TITLE_RULE } from "../../../src/lib/server/todos/messages.ts";

// The numbers come from the business rules, so the wording follows them.
describe("messages", () => {
  it("names the title's bounds", () => {
    expect(TITLE_RULE).toBe("Title must be 1 to 256 characters");
  });

  it("names the list's size", () => {
    expect(LIST_FULL).toBe(
      "This list is full — it holds 500 to-dos. Clear completed or remove some to add more.",
    );
  });
});
