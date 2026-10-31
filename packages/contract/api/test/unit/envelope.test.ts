import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { HealthReply, envelope } from "../../src/index.ts";

const HealthEnvelope = envelope(HealthReply);

describe("envelope", () => {
  it("rejects a body that is not an object", () => {
    expect(v.is(HealthEnvelope, "ok")).toBe(false);
  });

  it("rejects a body without ok", () => {
    expect(v.is(HealthEnvelope, { data: { ok: true } })).toBe(false);
  });

  it("rejects a success whose data does not match the reply", () => {
    expect(v.is(HealthEnvelope, { ok: true, data: { ok: false } })).toBe(false);
  });

  it("rejects an unknown error kind", () => {
    const body = { ok: false, error: { kind: "teapot", message: "no" } };
    expect(v.is(HealthEnvelope, body)).toBe(false);
  });

  it("rejects a validation error without field", () => {
    const body = { ok: false, error: { kind: "validation", message: "no" } };
    expect(v.is(HealthEnvelope, body)).toBe(false);
  });

  it("rejects field on a kind other than validation", () => {
    const body = {
      ok: false,
      error: { kind: "not_found", message: "no", field: "id" },
    };
    expect(v.is(HealthEnvelope, body)).toBe(false);
  });

  it("accepts an error", () => {
    const body = {
      ok: false,
      error: { kind: "validation", message: "too long", field: "title" },
    };
    expect(v.is(HealthEnvelope, body)).toBe(true);
  });

  it("accepts a success", () => {
    expect(v.is(HealthEnvelope, { ok: true, data: { ok: true } })).toBe(true);
  });
});
