import { TITLE_MAX } from "@todo/business/todos/todo.ts";
import { describe, expect, it } from "vitest";
import { validateTitle } from "../../../../../src/app/handlers/todos/validate.ts";

describe("validateTitle", () => {
  it("rejects a title that is empty after trim", () => {
    const result = validateTitle({ title: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: "invalid", field: "title", message: "title is empty" },
    });
  });

  it("rejects a title one over the limit", () => {
    const result = validateTitle({ title: "x".repeat(TITLE_MAX + 1) });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: "invalid", field: "title", message: "title is longer than 256 characters" },
    });
  });

  it("accepts a title at the limit", () => {
    const title = "x".repeat(TITLE_MAX);

    expect(validateTitle({ title })).toEqual({ ok: true, value: { title } });
  });

  it("measures the limit after trim", () => {
    const title = "x".repeat(TITLE_MAX);

    expect(validateTitle({ title: `  ${title}  ` })).toEqual({ ok: true, value: { title } });
  });

  it("trims the title into the new todo", () => {
    expect(validateTitle({ title: "  buy milk  " })).toEqual({
      ok: true,
      value: { title: "buy milk" },
    });
  });
});
