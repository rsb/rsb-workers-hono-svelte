import { expect, it } from "vitest";
import { checkTitle } from "../../../src/todos/title.ts";

it("gives the title trimmed", () => {
  expect(checkTitle("  buy milk  ")).toEqual({ ok: true, value: "buy milk" });
});

it("an empty title is empty", () => {
  expect(checkTitle("")).toEqual({ ok: false, error: "empty" });
});

it("a title of only spaces is empty", () => {
  expect(checkTitle("   ")).toEqual({ ok: false, error: "empty" });
});

it("256 characters is valid", () => {
  const title = "a".repeat(256);

  expect(checkTitle(title)).toEqual({ ok: true, value: title });
});

it("257 characters is too long", () => {
  expect(checkTitle("a".repeat(257))).toEqual({ ok: false, error: "too_long" });
});

it("the length is counted after trim", () => {
  const title = "a".repeat(256);

  expect(checkTitle(`  ${title}  `)).toEqual({ ok: true, value: title });
});
