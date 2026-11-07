import { redirect } from "@sveltejs/kit";
import { dev } from "$app/env";
import { sessionCookie } from "#lib/server/session/cookie.ts";
import { CLEAR_SITE_DATA, SIGNED_OUT_TO, signOut } from "#lib/server/session/sign-out.ts";
import type { Actions, PageServerLoad } from "./$types";

/**
 * Sign-out has no page: it is a POST, never a GET (threats row 2), so an
 * address bar or a link that lands here goes to the list.
 */
export const load: PageServerLoad = () => redirect(303, "/");

export const actions = {
  default: async ({ locals, cookies, setHeaders }) => {
    await signOut(locals.api, cookies, { name: sessionCookie(dev), secure: !dev });
    setHeaders({ "clear-site-data": CLEAR_SITE_DATA });
    redirect(303, SIGNED_OUT_TO);
  },
} satisfies Actions;
