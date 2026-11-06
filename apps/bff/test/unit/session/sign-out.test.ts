import { describe, expect, it } from "vitest";
import { SIGNED_OUT_NOTICE } from "../../../src/lib/shell/views.ts";
import { CLEAR_SITE_DATA, SIGNED_OUT_TO, signOut } from "../../../src/lib/server/session/sign-out.ts";

type Deleted = { name: string; options: unknown };

/** A cookie jar that records each cookie deleted. */
const jar = () => {
  const deleted: Deleted[] = [];
  const cookies = {
    delete: (name: string, options: unknown) => {
      deleted.push({ name, options });
    },
  };
  return { cookies, deleted };
};

/** A fake binding that answers once, and records what it was asked. */
const binding = (status: number, body: unknown) => {
  const asked: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    asked.push({ url, init });
    return Response.json(body, { status });
  };
  return { api: { fetch } as Pick<Fetcher, "fetch">, asked };
};

const refused = (kind: string, status: number) => binding(status, { ok: false, error: { kind, message: "for developers" } });

const signedOut = () => binding(200, { ok: true, data: { signedOut: true } });

describe("signOut", () => {
  it("asks the api to end this device's session, then deletes the cookie with the options it was set with", async () => {
    const { api, asked } = signedOut();
    const { cookies, deleted } = jar();

    const result = await signOut(api, cookies, { name: "sid", secure: false });

    expect(result).toEqual({ signedOut: true });
    expect(asked).toHaveLength(1);
    expect(asked[0]?.url).toBe("https://todo-api/sessions/current");
    expect(asked[0]?.init?.method).toBe("DELETE");
    expect(deleted).toEqual([{ name: "sid", options: { path: "/", httpOnly: true, secure: false, sameSite: "lax" } }]);
  });

  it("deletes the deployed cookie, Secure, under its __Host- name", async () => {
    const { cookies, deleted } = jar();

    await signOut(signedOut().api, cookies, { name: "__Host-sid", secure: true });

    expect(deleted).toEqual([{ name: "__Host-sid", options: { path: "/", httpOnly: true, secure: true, sameSite: "lax" } }]);
  });

  // `sign-out.md`, Refused: a session another sign-out, a sign-out
  // everywhere or a rotation ended first. The person asked to be signed
  // out, and is.
  it("is signed out, and deletes the cookie, when the api says the cookie names no live session", async () => {
    const { cookies, deleted } = jar();

    const result = await signOut(refused("unauthenticated", 401).api, cookies, { name: "sid", secure: false });

    expect(result).toEqual({ signedOut: true });
    expect(deleted).toHaveLength(1);
  });

  // Whether the session ended is not known, so the cookie stays and
  // signing out again is safe.
  it.each([
    ["internal", 500],
    ["forbidden", 403],
    ["validation", 422],
  ])("throws, for accounts.error.failed, and keeps the cookie, when the api answers %s", async (kind, status) => {
    const { cookies, deleted } = jar();

    await expect(signOut(refused(kind, status).api, cookies, { name: "sid", secure: false })).rejects.toThrow("sign-out failed");
    expect(deleted).toEqual([]);
  });

  it("throws, and keeps the cookie, when the api cannot be read", async () => {
    const { cookies, deleted } = jar();

    await expect(signOut(binding(200, "not an envelope").api, cookies, { name: "sid", secure: false })).rejects.toThrow();
    expect(deleted).toEqual([]);
  });
});

describe("where a sign-out lands", () => {
  it("is the list's page, asked for the notice", () => {
    expect(SIGNED_OUT_TO).toBe("/?signed-out");
  });

  it("asks the browser to clear its cache only, never the domain's cookies", () => {
    expect(CLEAR_SITE_DATA).toBe('"cache"');
  });

  it("says so with the board's words", () => {
    expect(SIGNED_OUT_NOTICE).toBe("You’re signed out on this device.");
  });
});
