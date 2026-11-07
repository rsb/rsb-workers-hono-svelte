import { redirect } from "@sveltejs/kit";
import { dev } from "$app/env";
import { sessionCookie } from "#lib/server/session/cookie.ts";
import { signIn } from "#lib/server/session/sign-in.ts";
import type { Actions } from "./$types";

/**
 * `/sign-in` reads nothing before it renders (`feature-accounts-sign-in.md`,
 * Reads): the frame's actor read is the page load's only call. Its one
 * action signs in, and a signed-in browser goes to its list.
 */
export const actions = {
  default: async ({ request, locals, cookies }) => {
    const cookie = { name: sessionCookie(dev), secure: !dev };
    const result = await signIn(locals.api, await request.formData(), cookies, cookie);
    if ("signedIn" in result) {
      redirect(303, "/");
    }
    return result;
  },
} satisfies Actions;
