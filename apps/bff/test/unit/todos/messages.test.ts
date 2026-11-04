import { describe, expect, it } from "vitest";
import type { ErrorKind } from "@todo/contract-api";
import type { Problem } from "@todo/valid/problem.ts";
import {
  LIST_FULL,
  SOMETHING_WENT_WRONG,
  addFailedMessage,
  problemMessage,
} from "../../../src/lib/server/todos/messages.ts";

describe("messages", () => {
  it("says the list is full without a number, since no problem carries one", () => {
    expect(LIST_FULL).toBe("The list is full. Clear completed or remove some to add more.");
  });
});

describe("problemMessage", () => {
  it.each<[string, Problem, string]>([
    ["title.empty", { field: "title", rule: "title.empty", max: 256 }, "Title must be 1 to 256 characters"],
    ["title.too_long", { field: "title", rule: "title.too_long", max: 256 }, "Title must be 1 to 256 characters"],
    ["not_text", { field: "title", rule: "not_text" }, SOMETHING_WENT_WRONG],
    ["not_boolean", { field: "completed", rule: "not_boolean" }, SOMETHING_WENT_WRONG],
    ["patch.empty", { rule: "patch.empty" }, SOMETHING_WENT_WRONG],
  ])("words %s", (_, problem, message) => {
    expect(problemMessage(problem)).toBe(message);
  });

  it.each<[string, Problem]>([
    ["title.empty", { field: "title", rule: "title.empty", max: 10 }],
    ["title.too_long", { field: "title", rule: "title.too_long", max: 10 }],
  ])("words %s from the max the problem carries", (_, problem) => {
    expect(problemMessage(problem)).toBe("Title must be 1 to 10 characters");
  });
});

describe("addFailedMessage", () => {
  it.each<[ErrorKind, string]>([
    ["limit", LIST_FULL],
    ["validation", SOMETHING_WENT_WRONG],
    ["internal", SOMETHING_WENT_WRONG],
  ])("words %s", (kind, message) => {
    expect(addFailedMessage(kind)).toBe(message);
  });
});
