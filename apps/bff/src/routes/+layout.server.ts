import { dev } from "$app/env";
import { loadFrame } from "#lib/server/session/frame.ts";
import { sessionCookie } from "#lib/server/session/cookie.ts";
import type { LayoutServerLoad } from "./$types";

/** The frame of every page: who the request acts for (`accounts.shell`). */
export const load: LayoutServerLoad = ({ locals, route, cookies }) =>
  loadFrame(locals.api, route.id, cookies, sessionCookie(dev));
