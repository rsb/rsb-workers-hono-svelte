import type { Cookies } from "@sveltejs/kit";
import type { Frame } from "#lib/shell/account.ts";
import { getCurrentSession } from "../api/sessions.ts";

/** The probe's route, the one page outside the frame. */
const PROBE = "/health";

/**
 * Up to two initials: the first letters of the name's first and last
 * words, or the email's first letter when the name has none.
 */
export const initials = (name: string, email: string): string => {
  const words = name.trim().split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) {
    return email.slice(0, 1).toUpperCase();
  }
  const first = words[0] ?? "";
  let last = "";
  if (words.length > 1) {
    last = words[words.length - 1] ?? "";
  }
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
};

/**
 * Reads the actor once per page load (`feature-accounts-shell.md`, Reads),
 * and deletes a cookie that names no live session, since the api never
 * writes `Set-Cookie` (L39). It never throws: an error thrown in the root
 * layout's load would skip `+error.svelte` for the bare `src/error.html`,
 * outside the frame. Any failure is `failed`, a disabled account's
 * `forbidden` among them until D (`feature-accounts-shell.md`, Views).
 */
export async function loadFrame(
  api: Pick<Fetcher, "fetch">,
  routeId: string | null,
  cookies: Pick<Cookies, "delete">,
  cookieName: string,
): Promise<Frame> {
  if (routeId === PROBE) {
    return { probe: true };
  }

  const reply = await getCurrentSession(api);
  if (!reply.ok) {
    return { probe: false, account: { state: "failed" } };
  }

  const { user, clearCookie } = reply.data;
  if (clearCookie) {
    cookies.delete(cookieName, { path: "/" });
  }
  if (user === undefined) {
    return { probe: false, account: { state: "anonymous" } };
  }

  const person = {
    name: user.name,
    email: user.email,
    initials: initials(user.name, user.email),
    admin: user.role === "admin",
  };
  return { probe: false, account: { state: "signed_in", person } };
}

/**
 * The headers of a page drawn for a signed-in person: `no-store`, so no
 * cache keeps it, and Back after sign-out asks again and shows no list
 * (L50). A page drawn for nobody shows nothing of anyone's.
 */
export const frameHeaders = (frame: Frame): Record<string, string> => {
  if (!frame.probe && frame.account.state === "signed_in") {
    return { "cache-control": "no-store" };
  }
  return {};
};
