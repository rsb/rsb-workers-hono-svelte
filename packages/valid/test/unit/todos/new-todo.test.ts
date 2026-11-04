import { describe, expect, it } from "vitest";
import { toNewTodo } from "../../../src/todos/new-todo.ts";

/** One astral-plane character: two UTF-16 code units. */
const EMOJI = "😀";

describe("toNewTodo", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["a number", 7],
    ["a boolean", true],
    ["an object", { text: "buy milk" }],
  ])("refuses a title that is %s as not_text", (_, value) => {
    expect(toNewTodo({ title: value })).toEqual({ ok: false, error: [{ field: "title", rule: "not_text" }] });
  });

  it("refuses an empty title", () => {
    expect(toNewTodo({ title: "" })).toEqual({ ok: false, error: [{ field: "title", rule: "title.empty", max: 256 }] });
  });

  it("refuses a title of only spaces", () => {
    expect(toNewTodo({ title: "  \t\n " })).toEqual({ ok: false, error: [{ field: "title", rule: "title.empty", max: 256 }] });
  });

  it("refuses 257 characters as too long, with the max", () => {
    const tooLong = { field: "title", rule: "title.too_long", max: 256 };

    expect(toNewTodo({ title: "a".repeat(257) })).toEqual({ ok: false, error: [tooLong] });
  });

  it("counts UTF-16 code units: 255 characters and an emoji is 257, too long", () => {
    const title = `${"a".repeat(255)}${EMOJI}`;
    const tooLong = { field: "title", rule: "title.too_long", max: 256 };

    expect(toNewTodo({ title })).toEqual({ ok: false, error: [tooLong] });
  });

  it("counts UTF-16 code units: 254 characters and an emoji is 256, valid", () => {
    const title = `${"a".repeat(254)}${EMOJI}`;

    expect(toNewTodo({ title })).toEqual({ ok: true, value: { title } });
  });

  it("counts the length after trim", () => {
    const title = "a".repeat(256);

    expect(toNewTodo({ title: `  ${title}  ` })).toEqual({ ok: true, value: { title } });
  });

  it("accepts 256 characters", () => {
    const title = "a".repeat(256);

    expect(toNewTodo({ title })).toEqual({ ok: true, value: { title } });
  });

  it("gives the new todo with its title trimmed", () => {
    expect(toNewTodo({ title: "  buy milk  " })).toEqual({ ok: true, value: { title: "buy milk" } });
  });
});
