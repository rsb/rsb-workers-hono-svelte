import { describe, expect, it } from "vitest";
import { toCompleted } from "../../../src/todos/completed.ts";

describe("toCompleted", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["a number", 1],
    ['"yes"', "yes"],
    ['"on"', "on"],
    ['""', ""],
  ])("refuses completed that is %s as not_boolean", (_, value) => {
    expect(toCompleted({ completed: value })).toEqual({
      ok: false,
      error: [{ field: "completed", rule: "not_boolean" }],
    });
  });

  it.each([
    ["true", true, true],
    ['"true"', "true", true],
    ["false", false, false],
    ['"false"', "false", false],
  ])("reads %s", (_, value, completed) => {
    expect(toCompleted({ completed: value })).toEqual({ ok: true, value: completed });
  });
});
