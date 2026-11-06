import { describe, expect, it } from "vitest";
import type { ApiError } from "@todo/contract-api";
import type { Problem } from "@todo/valid/problem.ts";
import {
  LIST_FULL,
  SOMETHING_WENT_WRONG,
  addFailedMessage,
  failedMessage,
  problemMessage,
} from "../../../src/lib/server/todos/messages.ts";

describe("messages", () => {
  it("says the list is full without a number, since no problem carries one", () => {
    expect(LIST_FULL).toBe("The list is full. Clear completed or remove some to add more.");
  });
});

describe("problemMessage", () => {
  it.each<[string, Problem, string]>([
    ["title.length empty", { field: "title", rule: "title.length", violation: "empty", max: 256 }, "Title must be 1 to 256 characters"],
    ["title.length too_long", { field: "title", rule: "title.length", violation: "too_long", max: 256 }, "Title must be 1 to 256 characters"],
    ["not_text", { field: "title", rule: "not_text" }, SOMETHING_WENT_WRONG],
    ["not_boolean", { field: "completed", rule: "not_boolean" }, SOMETHING_WENT_WRONG],
    ["patch.nonempty", { rule: "patch.nonempty", violation: "empty" }, SOMETHING_WENT_WRONG],
    ["email.length, which no todo form carries", { field: "email", rule: "email.length", violation: "empty", max: 254 }, SOMETHING_WENT_WRONG],
    ["email.shape, which no todo form carries", { field: "email", rule: "email.shape", violation: "malformed" }, SOMETHING_WENT_WRONG],
    ["password.given, which no todo form carries", { field: "password", rule: "password.given", violation: "empty", max: 128 }, SOMETHING_WENT_WRONG],
  ])("words %s", (_, problem, message) => {
    expect(problemMessage(problem)).toBe(message);
  });

  it.each<[string, Problem]>([
    ["title.length empty", { field: "title", rule: "title.length", violation: "empty", max: 10 }],
    ["title.length too_long", { field: "title", rule: "title.length", violation: "too_long", max: 10 }],
  ])("words %s from the max the problem carries", (_, problem) => {
    expect(problemMessage(problem)).toBe("Title must be 1 to 10 characters");
  });
});

/** An error the API answers with, for each kind and, for `forbidden`, each reason. */
const errors: [string, ApiError][] = [
  ["validation", { kind: "validation", field: "title", message: "for developers" }],
  ["unauthenticated", { kind: "unauthenticated", message: "for developers" }],
  ["forbidden channel", { kind: "forbidden", reason: "channel", message: "for developers" }],
  ["forbidden account_disabled", { kind: "forbidden", reason: "account_disabled", message: "for developers" }],
  ["forbidden role", { kind: "forbidden", reason: "role", message: "for developers" }],
  ["not_found", { kind: "not_found", message: "for developers" }],
  ["limit", { kind: "limit", message: "for developers" }],
  ["too_large", { kind: "too_large", message: "for developers" }],
  ["internal", { kind: "internal", message: "for developers" }],
];

describe("failedMessage", () => {
  // In slice A no failure is one the person can fix; D words `role`.
  it.each(errors)("words %s as something went wrong", (_, error) => {
    expect(failedMessage(error)).toBe(SOMETHING_WENT_WRONG);
  });
});

describe("addFailedMessage", () => {
  it.each(errors)("words %s as any action does, but limit", (name, error) => {
    let message = SOMETHING_WENT_WRONG;
    if (name === "limit") {
      message = LIST_FULL;
    }
    expect(addFailedMessage(error)).toBe(message);
  });
});
