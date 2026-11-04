import { describe, expect, it } from "vitest";
import type { Problems } from "@todo/valid/problem.ts";
import { invalidOf } from "../../../../src/app/handlers/messages.ts";

/** The kind, field and message of the failure, without its chain. */
const shown = (problems: Problems) => {
  const failure = invalidOf(problems);
  return { kind: failure.kind, field: failure.field, message: failure.message };
};

describe("invalidOf", () => {
  it.each<[string, Problems, string, string]>([
    ["not_text", [{ field: "title", rule: "not_text" }], "title", "title must be text"],
    ["not_boolean", [{ field: "completed", rule: "not_boolean" }], "completed", "completed must be true or false"],
    ["title.length empty", [{ field: "title", rule: "title.length", violation: "empty", max: 256 }], "title", "title is empty"],
    [
      "title.length too_long",
      [{ field: "title", rule: "title.length", violation: "too_long", max: 256 }],
      "title",
      "title is longer than 256 characters",
    ],
    ["patch.nonempty", [{ rule: "patch.nonempty", violation: "empty" }], "body", "body must have title, completed or both"],
  ])("words %s as prd/todo/api.md does", (_, problems, field, message) => {
    expect(shown(problems)).toEqual({ kind: "invalid", field, message });
  });

  it("words the max the problem carries", () => {
    const problems: Problems = [{ field: "title", rule: "title.length", violation: "too_long", max: 10 }];

    expect(shown(problems).message).toBe("title is longer than 10 characters");
  });

  it("shows the first problem only", () => {
    const problems: Problems = [
      { field: "title", rule: "title.length", violation: "empty", max: 256 },
      { field: "completed", rule: "not_boolean" },
    ];

    expect(shown(problems)).toEqual({ kind: "invalid", field: "title", message: "title is empty" });
  });
});
