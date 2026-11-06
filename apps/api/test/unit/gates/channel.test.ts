import { Failure } from "@todo/contract-api";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { fakeIdentityStore } from "../fake-identity-store.ts";
import { config, testApi } from "../test-api.ts";
import { BEARER_TOKEN, MEMBER_TOKEN, sessionRows } from "./session-rows.ts";

// The `channel` gate (L38) through the whole api: an unsafe request with
// the session cookie must come from the BFF's page and send JSON.

const COOKIE = `${config.sessionCookie}=${MEMBER_TOKEN}`;
const JSON_TYPE = { "Content-Type": "application/json" };

const add = (headers: Record<string, string>, body = '{"title":"buy milk"}') => {
  const api = testApi({ identityStore: fakeIdentityStore(sessionRows).store });
  return api.request("/todos", { method: "POST", body, headers });
};

const refusedForChannel = async (response: Response, message: string) => {
  expect(response.status).toBe(403);
  expect(v.parse(Failure, await response.json()).error).toEqual({ kind: "forbidden", reason: "channel", message });
};

describe("an unsafe request with the session cookie", () => {
  it.each(["same-origin", "none"])("goes on when Sec-Fetch-Site is %s", async (site) => {
    const response = await add({ Cookie: COOKIE, "Sec-Fetch-Site": site, ...JSON_TYPE });
    expect(response.status).toBe(201);
  });

  it.each(["same-site", "cross-site"])("is refused when Sec-Fetch-Site is %s", async (site) => {
    const response = await add({ Cookie: COOKIE, "Sec-Fetch-Site": site, Origin: config.bffOrigin, ...JSON_TYPE });
    await refusedForChannel(response, "the request does not come from the BFF's page");
  });

  it("goes on without Sec-Fetch-Site when Origin is the BFF's", async () => {
    const response = await add({ Cookie: COOKIE, Origin: config.bffOrigin, ...JSON_TYPE });
    expect(response.status).toBe(201);
  });

  it("is refused without Sec-Fetch-Site when Origin is another's", async () => {
    const response = await add({ Cookie: COOKIE, Origin: "https://evil.test", ...JSON_TYPE });
    await refusedForChannel(response, "the request does not come from the BFF's page");
  });

  it("is refused with neither Sec-Fetch-Site nor Origin", async () => {
    const response = await add({ Cookie: COOKIE, ...JSON_TYPE });
    await refusedForChannel(response, "the request says neither its site nor its origin");
  });

  it.each([
    ["a form", "application/x-www-form-urlencoded"],
    ["plain text", "text/plain"],
    ["a multipart form", "multipart/form-data; boundary=x"],
  ])("is refused when its body is %s", async (_, type) => {
    const response = await add({ Cookie: COOKIE, "Sec-Fetch-Site": "same-origin", "Content-Type": type });
    await refusedForChannel(response, "a request with the session cookie sends its body as application/json");
  });

  it("is refused when its body has no type", async () => {
    const response = await add({ Cookie: COOKIE, "Sec-Fetch-Site": "same-origin" });
    await refusedForChannel(response, "a request with the session cookie sends its body as application/json");
  });

  it("goes on with JSON and a charset", async () => {
    const response = await add({ Cookie: COOKIE, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json; charset=utf-8" });
    expect(response.status).toBe(201);
  });

  it("goes on with no body and no type", async () => {
    const api = testApi({ identityStore: fakeIdentityStore(sessionRows).store });
    const response = await api.request("/todos?completed=true", {
      method: "DELETE",
      headers: { Cookie: COOKIE, "Sec-Fetch-Site": "same-origin" },
    });
    expect(response.status).toBe(200);
  });
});

describe("a request the gate does not check", () => {
  it("is a safe one with the session cookie, from another site", async () => {
    const api = testApi({ identityStore: fakeIdentityStore(sessionRows).store });
    const response = await api.request("/todos", { headers: { Cookie: COOKIE, "Sec-Fetch-Site": "cross-site" } });
    expect(response.status).toBe(200);
  });

  it("is an unsafe one with no cookie, since there is no session to ride", async () => {
    const response = await add({ "Sec-Fetch-Site": "cross-site", "Content-Type": "text/plain" });
    // Past the gate, the handler reads the body as JSON whatever its type.
    expect(response.status).toBe(201);
  });

  it("is an unsafe one with a bearer token, which no browser sends on its own", async () => {
    const response = await add({ Authorization: `Bearer ${BEARER_TOKEN}`, "Sec-Fetch-Site": "cross-site", ...JSON_TYPE });
    expect(response.status).toBe(201);
  });

  it("is one with a cookie of another name", async () => {
    const response = await add({ Cookie: `other=${MEMBER_TOKEN}`, "Sec-Fetch-Site": "cross-site", ...JSON_TYPE });
    expect(response.status).toBe(201);
  });
});
