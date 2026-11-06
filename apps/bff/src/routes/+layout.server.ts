import { dev } from "$app/env";
import { frameHeaders, loadFrame } from "#lib/server/session/frame.ts";
import { sessionCookie } from "#lib/server/session/cookie.ts";
import type { LayoutServerLoad } from "./$types";

/**
 * The frame of every page: who the request acts for (`accounts.shell`).
 * A signed-in person's page is never stored (`frameHeaders`).
 */
export const load: LayoutServerLoad = async ({ locals, route, cookies, setHeaders }) => {
  const frame = await loadFrame(locals.api, route.id, cookies, sessionCookie(dev));
  setHeaders(frameHeaders(frame));
  return frame;
};
