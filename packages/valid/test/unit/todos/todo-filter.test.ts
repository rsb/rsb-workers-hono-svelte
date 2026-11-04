import { describe, expect, it } from "vitest";
import { toTodoFilter } from "../../../src/todos/todo-filter.ts";

describe("toTodoFilter", () => {
  it("applies no rule, as its rules say", () => {
    expect(toTodoFilter.rules).toEqual([]);
  });

  it.each([
    ["null", null],
    ["a number", 0],
    ['"yes"', "yes"],
    ['"on"', "on"],
    ['""', ""],
  ])("refuses completed that is %s as not_boolean", (_, value) => {
    expect(toTodoFilter({ completed: value })).toEqual({
      ok: false,
      error: [{ field: "completed", rule: "not_boolean" }],
    });
  });

  it.each([
    ["true", true, true],
    ['"true"', "true", true],
    ["false", false, false],
    ['"false"', "false", false],
  ])("filters by completed %s", (_, value, completed) => {
    expect(toTodoFilter({ completed: value })).toEqual({ ok: true, value: { completed } });
  });

  it("keeps every todo when completed is missing", () => {
    expect(toTodoFilter({})).toEqual({ ok: true, value: {} });
  });
});
