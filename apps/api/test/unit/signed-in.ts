import { fakeIdentityStore } from "./fake-identity-store.ts";
import { ADMIN_BEARER_TOKEN, BEARER_TOKEN, sessionRows } from "./gates/session-rows.ts";
import { testApi } from "./test-api.ts";

// Every todo operation requires a member (`prd/todo/access.md`), so a
// request that should reach one carries a session. A bearer token is the
// credential here: the channel gate checks only a cookie, so a request
// needs no browser headers to pass it.

/** The tokens of the two signed-in actors: the member `u1`, and the admin `u-admin`. */
export const MEMBER = BEARER_TOKEN;
export const ADMIN = ADMIN_BEARER_TOKEN;

type Parts = Omit<Parameters<typeof testApi>[0] & {}, "identityStore">;

/**
 * The whole api, as `testApi` builds it, whose every request is sent with
 * `token` as its bearer token. Two actors given the same `dbStore` share
 * one database, as two users do.
 */
export const signedIn = (token: string, parts: Parts = {}) => {
  const api = testApi({ ...parts, identityStore: fakeIdentityStore(sessionRows).store });
  return {
    request: (path: string, init: RequestInit = {}) =>
      api.request(path, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } }),
  };
};
