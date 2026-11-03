import { TITLE_MAX } from "@todo/business/todos/todo.ts";
import { describe, expect, it } from "vitest";
import { TITLE_RULE } from "../../../src/lib/server/todos/messages.ts";
import { validateTitle } from "../../../src/lib/server/todos/validate-title.ts";

describe("validateTitle", () => {
  it("rejects a title that is empty after trim", () => {
    expect(validateTitle({ title: "   " })).toEqual({ ok: false, error: TITLE_RULE });
  });

  it("rejects a title one over the limit", () => {
    const result = validateTitle({ title: "x".repeat(TITLE_MAX + 1) });

    expect(result).toEqual({ ok: false, error: TITLE_RULE });
  });

  it("accepts a title at the limit, measured after trim", () => {
    const title = "x".repeat(TITLE_MAX);

    expect(validateTitle({ title: `  ${title}  ` })).toEqual({ ok: true, value: { title } });
  });
});
