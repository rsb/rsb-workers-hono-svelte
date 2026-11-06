import type { Handle, HandleServerError } from "@sveltejs/kit/hooks";
import { env } from "cloudflare:workers";
import { forwarding } from "#lib/server/api/forward.ts";
import { shellError } from "#lib/shell/views.ts";

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

/**
 * Every error thrown while answering a request comes through here
 * (Kit 3: `error()` included, told apart by `kind`), and leaves with the
 * view for its status. A fault is logged; it is the only kind nobody chose.
 */
export const handleError: HandleServerError = (caught) => {
  if (caught.kind === "unknown") {
    console.error(caught.error);
  }
  return shellError(caught);
};
