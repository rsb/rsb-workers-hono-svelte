import { expect, it } from "vitest";
import { readConfig } from "../../src/config.ts";

const fakeD1 = { prepare: () => undefined, batch: () => undefined };

it("builds a frozen config from a D1 binding", () => {
  const config = readConfig({ DB: fakeD1 });

  expect(config).toEqual({ ok: true, value: { db: fakeD1 } });
  expect(config.ok && Object.isFrozen(config.value)).toBe(true);
});

it("fails, naming the value, when DB is missing", () => {
  expect(readConfig({})).toEqual({ ok: false, error: "DB is missing or is not a D1 binding" });
});

it("fails when DB is not a D1 binding", () => {
  expect(readConfig({ DB: "todo" })).toEqual({
    ok: false,
    error: "DB is missing or is not a D1 binding",
  });
});
