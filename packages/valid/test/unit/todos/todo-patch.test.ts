import { describe, expect, it } from "vitest";
import { toTodoPatch } from "../../../src/todos/todo-patch.ts";

/** One astral-plane character: two UTF-16 code units. */
const EMOJI = "😀";

describe("toTodoPatch", () => {
  it("applies patch.nonempty, title.length, as its rules say", () => {
    expect(toTodoPatch.rules).toEqual(["patch.nonempty", "title.length"]);
  });

  it("refuses a patch with neither title nor completed as patch.nonempty", () => {
    expect(toTodoPatch({})).toEqual({ ok: false, error: [{ rule: "patch.nonempty", violation: "empty" }] });
  });

  it("reads undefined fields as not given", () => {
    expect(toTodoPatch({ title: undefined, completed: undefined })).toEqual({
      ok: false,
      error: [{ rule: "patch.nonempty", violation: "empty" }],
    });
  });

  it.each([
    ["null", null],
    ["a number", 7],
    ["a boolean", true],
  ])("refuses a title that is %s as not_text", (_, value) => {
    expect(toTodoPatch({ title: value })).toEqual({ ok: false, error: [{ field: "title", rule: "not_text" }] });
  });

  it("refuses a title of only spaces", () => {
    expect(toTodoPatch({ title: "   " })).toEqual({ ok: false, error: [{ field: "title", rule: "title.length", violation: "empty", max: 256 }] });
  });

  it("refuses a title too long, counted in UTF-16 code units", () => {
    const title = `${"a".repeat(255)}${EMOJI}`;
    const tooLong = { field: "title", rule: "title.length", violation: "too_long", max: 256 };

    expect(toTodoPatch({ title })).toEqual({ ok: false, error: [tooLong] });
  });

  it.each([
    ["null", null],
    ["a number", 1],
    ['"yes"', "yes"],
    ['"on"', "on"],
    ['"TRUE"', "TRUE"],
    ['""', ""],
  ])("refuses completed that is %s as not_boolean", (_, value) => {
    expect(toTodoPatch({ completed: value })).toEqual({
      ok: false,
      error: [{ field: "completed", rule: "not_boolean" }],
    });
  });

  it("gives every problem, title first", () => {
    expect(toTodoPatch({ title: "", completed: "yes" })).toEqual({
      ok: false,
      error: [
        { field: "title", rule: "title.length", violation: "empty", max: 256 },
        { field: "completed", rule: "not_boolean" },
      ],
    });
  });

  it.each([
    ["true", true, true],
    ['"true"', "true", true],
    ["false", false, false],
    ['"false"', "false", false],
  ])("reads completed %s", (_, value, completed) => {
    expect(toTodoPatch({ completed: value })).toEqual({ ok: true, value: { completed } });
  });

  it("gives a patch of the title alone, trimmed", () => {
    expect(toTodoPatch({ title: "  buy milk  " })).toEqual({ ok: true, value: { title: "buy milk" } });
  });

  it("gives a patch of both", () => {
    expect(toTodoPatch({ title: "buy milk", completed: "true" })).toEqual({
      ok: true,
      value: { title: "buy milk", completed: true },
    });
  });
});
