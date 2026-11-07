import { redirect } from "@sveltejs/kit";
import { dev } from "$app/env";
import { sessionCookie } from "#lib/server/session/cookie.ts";
import { loadSessions } from "#lib/server/session/load-sessions.ts";
import { CLEAR_SITE_DATA, SIGNED_OUT_TO, signOutEverywhere } from "#lib/server/session/sign-out.ts";
import type { Actions, PageServerLoad } from "./$types";

/** The profile page, Sessions only in B (Q5). */
export const load: PageServerLoad = ({ locals }) => loadSessions(locals.api, Date.now());

export const actions = {
  // A plain POST and a whole-page navigation, as the shell's sign-out.
  everywhere: async ({ locals, cookies, setHeaders }) => {
    await signOutEverywhere(locals.api, cookies, { name: sessionCookie(dev), secure: !dev });
    setHeaders({ "clear-site-data": CLEAR_SITE_DATA });
    redirect(303, SIGNED_OUT_TO);
  },
} satisfies Actions;
