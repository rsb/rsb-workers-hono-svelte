/**
 * The session cookie's name, which the BFF needs only to delete one that
 * names no live session (the api never writes `Set-Cookie`, L39).
 *
 * The api reads one name from its config and never branches. The branch
 * is here because it is a fact of the browser's transport, which the
 * delivery owns: no browser accepts a `__Host-` cookie over http, so local
 * dev, on http://localhost, uses the name without the prefix (handoff 23).
 * `tooling/config/session-cookie.test.ts` keeps both names equal to the
 * api's. This file imports nothing, so that test can read it as it is.
 */

/** The name the api is configured with (`apps/api/wrangler.jsonc`). */
export const SESSION_COOKIE = "__Host-sid";

/** The same name without the prefix, for local dev over http. */
export const DEV_SESSION_COOKIE = "sid";

/** The name a browser holds the session under, in dev or deployed. */
export const sessionCookie = (dev: boolean) => {
  if (dev) {
    return DEV_SESSION_COOKIE;
  }
  return SESSION_COOKIE;
};
