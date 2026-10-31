import { describe, expect, it } from "vitest";
import { readHealth } from "../../src/lib/server/health.ts";

/** A fake binding that answers every call with `reply`. */
const binding = (reply: () => Promise<Response>) => ({ fetch: reply });

describe("readHealth", () => {
  it("is down when the binding call fails", async () => {
    const api = binding(() => Promise.reject(new Error("binding failed")));
    expect(await readHealth(api)).toEqual({ api: "down" });
  });

  it("is down when the API answers with an error status", async () => {
    const api = binding(async () => Response.json({}, { status: 500 }));
    expect(await readHealth(api)).toEqual({ api: "down" });
  });

  it("is down when the body is not JSON", async () => {
    const api = binding(async () => new Response("<html>"));
    expect(await readHealth(api)).toEqual({ api: "down" });
  });

  it("is down when the body is not the health envelope", async () => {
    const api = binding(async () => Response.json({ ok: true }));
    expect(await readHealth(api)).toEqual({ api: "down" });
  });

  it("is up when the API answers ok", async () => {
    const api = binding(async () => Response.json({ ok: true, data: { ok: true } }));
    expect(await readHealth(api)).toEqual({ api: "up" });
  });
});
