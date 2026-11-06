import { describe, expect, it } from "vitest";
import { DEV_SESSION_COOKIE, SESSION_COOKIE, sessionCookie } from "../../../src/lib/server/session/cookie.ts";
import { frameHeaders, initials, loadFrame } from "../../../src/lib/server/session/frame.ts";

const member = { id: "u1", role: "member", emailVerified: true, name: "Dev Member", email: "member@example.test" };
const admin = { id: "u2", role: "admin", emailVerified: true, name: "Dev Admin", email: "admin@example.test" };

/** A fake binding that answers every request with this body, and records each URL it was asked. */
const answering = (body: unknown, status = 200) => {
  const asked: string[] = [];
  const fetch = async (url: string) => {
    asked.push(url);
    return Response.json(body, { status });
  };
  return { api: { fetch }, asked };
};

/** Fake cookies that record each name deleted, and the options it was deleted with. */
const recording = () => {
  const deleted: [string, unknown][] = [];
  return { cookies: { delete: (name: string, options: unknown) => deleted.push([name, options]) }, deleted };
};

const frame = (body: unknown, status = 200, routeId: string | null = "/[[filter=filter]]") => {
  const { api, asked } = answering(body, status);
  const { cookies, deleted } = recording();
  return { load: loadFrame(api, routeId, cookies, "sid"), asked, deleted };
};

describe("loadFrame", () => {
  it("reads the actor once, from GET /sessions/current", async () => {
    const { load, asked } = frame({ ok: true, data: { user: member, clearCookie: false } });
    await load;
    expect(asked).toEqual(["https://todo-api/sessions/current"]);
  });

  it("draws a member with their name, email and initials, and not as an admin", async () => {
    const { load } = frame({ ok: true, data: { user: member, clearCookie: false } });
    expect(await load).toEqual({
      probe: false,
      account: { state: "signed_in", person: { name: "Dev Member", email: "member@example.test", initials: "DM", admin: false } },
    });
  });

  it("draws an admin as an admin", async () => {
    const { load } = frame({ ok: true, data: { user: admin, clearCookie: false } });
    expect(await load).toMatchObject({ account: { person: { initials: "DA", admin: true } } });
  });

  it("is anonymous with no user, and deletes nothing when the api says not to", async () => {
    const { load, deleted } = frame({ ok: true, data: { clearCookie: false } });
    expect(await load).toEqual({ probe: false, account: { state: "anonymous" } });
    expect(deleted).toEqual([]);
  });

  it("deletes a cookie that names no live session, under the name it is given, for the whole site", async () => {
    const { load, deleted } = frame({ ok: true, data: { clearCookie: true } });
    expect(await load).toEqual({ probe: false, account: { state: "anonymous" } });
    expect(deleted).toEqual([["sid", { path: "/" }]]);
  });

  it("is failed, and does not throw, when the binding fails", async () => {
    const api = { fetch: () => Promise.reject(new Error("binding failed")) };
    const { cookies } = recording();
    expect(await loadFrame(api, "/", cookies, "sid")).toEqual({ probe: false, account: { state: "failed" } });
  });

  it("is failed for a disabled account until D", async () => {
    const refused = { ok: false, error: { kind: "forbidden", reason: "account_disabled", message: "for developers" } };
    const { load } = frame(refused, 403);
    expect(await load).toEqual({ probe: false, account: { state: "failed" } });
  });

  it("reads no actor for the probe, which has no frame", async () => {
    const { load, asked } = frame({ ok: true, data: { clearCookie: false } }, 200, "/health");
    expect(await load).toEqual({ probe: true });
    expect(asked).toEqual([]);
  });
});

describe("initials", () => {
  it.each([
    ["Dev Member", "member@example.test", "DM"],
    ["maya", "maya@example.test", "M"],
    ["Ana María de la Cruz", "ana@example.test", "AC"],
    ["  ", "sam@example.test", "S"],
  ])("of %j are %s", (name, email, expected) => {
    expect(initials(name, email)).toBe(expected);
  });
});

describe("sessionCookie", () => {
  it("is the api's name deployed, and the name without __Host- in dev, where the browser is on http", () => {
    expect(sessionCookie(false)).toBe(SESSION_COOKIE);
    expect(sessionCookie(true)).toBe(DEV_SESSION_COOKIE);
  });
});

describe("frameHeaders", () => {
  const person = { name: "Dev Member", email: "member@example.test", initials: "DM", admin: false };

  it("stores no page drawn for a signed-in person, so Back after sign-out asks again", () => {
    expect(frameHeaders({ probe: false, account: { state: "signed_in", person } })).toEqual({ "cache-control": "no-store" });
  });

  it.each([
    ["anonymous", { probe: false, account: { state: "anonymous" } }],
    ["failed", { probe: false, account: { state: "failed" } }],
    ["the probe", { probe: true }],
  ] as const)("adds nothing for %s", (_, frame) => {
    expect(frameHeaders(frame)).toEqual({});
  });
});
