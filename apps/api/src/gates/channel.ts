import type { Reason } from "@todo/contract-api";
import { forbidden } from "@todo/fail/fail.ts";
import type { Context, MiddlewareHandler } from "hono";
import { userFailure } from "../app/handlers/present.ts";
import { readCredentials } from "./credentials.ts";
import type { Channel } from "./variables.ts";

/** The methods that change nothing; the rest are unsafe. */
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** The `Sec-Fetch-Site` values a browser sends for the BFF's own page, or for a person typing the address. */
const OWN_SITE = new Set(["same-origin", "none"]);

/**
 * Why an unsafe request that is not bearer is refused, or undefined when it
 * may go on. A browser always sends `Sec-Fetch-Site` today; `Origin` is the
 * fallback for one that does not, and a request with neither is refused,
 * since nothing then says where it came from. A body must be JSON: a form
 * or `text/plain` body is what another site can send without a preflight.
 */
const refusal = (c: Context, bffOrigin: string): string | undefined => {
  const site = c.req.header("Sec-Fetch-Site");
  if (site !== undefined) {
    if (!OWN_SITE.has(site)) {
      return "the request does not come from the BFF's page";
    }
  } else {
    const origin = c.req.header("Origin");
    if (origin === undefined) {
      return "the request says neither its site nor its origin";
    }
    if (origin !== bffOrigin) {
      return "the request does not come from the BFF's page";
    }
  }

  if (c.req.raw.body !== null) {
    const type = c.req.header("Content-Type")?.split(";")[0]?.trim().toLowerCase();
    if (type !== "application/json") {
      return "a request from a browser sends its body as application/json";
    }
  }
  return undefined;
};

/**
 * The third gate (L38, amended by L49; binding only): attaches how the
 * request came, and refuses an unsafe request that is not bearer and is not
 * the BFF's own, as `forbidden`, reason `channel`. That is cookie or none:
 * a request without the cookie is checked too, since a sign-in carries no
 * cookie and another site's forged one would sign the victim in as the
 * attacker (login CSRF, threats row 1). A bearer token is not sent by a
 * browser on its own, so a bearer request is not checked here. SvelteKit's
 * origin check covers only form posts, and only in production; this one
 * covers every unsafe request, in every environment.
 */
export const channel = (deps: { bffOrigin: string; sessionCookie: string }): MiddlewareHandler => {
  return async (c, next) => {
    const { cookie, bearer } = readCredentials(c, deps.sessionCookie);
    let came: Channel = "none";
    if (cookie !== undefined) {
      came = "cookie";
    } else if (bearer !== undefined) {
      came = "bearer";
    }
    c.set("channel", came);

    if (came !== "bearer" && !SAFE.has(c.req.method)) {
      const why = refusal(c, deps.bffOrigin);
      if (why !== undefined) {
        return userFailure(c, forbidden("channel" satisfies Reason, why));
      }
    }
    await next();
  };
};
