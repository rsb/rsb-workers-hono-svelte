import type { Handle } from "@sveltejs/kit/hooks";
import { env } from "cloudflare:workers";
import { forwarding } from "#lib/server/api/forward.ts";

/**
 * Every load and action reaches the api through `locals.api`, which
 * forwards the browser's session cookie and where the request came from
 * (handoff 23: a fetcher in `handle`, not a `handleFetch` rewrite of
 * `event.fetch`, since a page's calls are not the browser request's path).
 */
export const handle: Handle = ({ event, resolve }) => {
  event.locals.api = forwarding(env.API, event.request);
  return resolve(event);
};
