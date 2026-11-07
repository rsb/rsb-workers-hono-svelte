import { type Cookies, fail } from "@sveltejs/kit";
import type { ApiError } from "@todo/contract-api";
import type { Problems } from "@todo/valid/problem.ts";
import { toSignIn } from "@todo/valid/auth/sign-in.ts";
import { postSession } from "../api/sessions.ts";
import { fieldMessage } from "./messages.ts";

/** What each sign-in field says is wrong with it; a field with nothing wrong is absent. */
export type FieldErrors = { email?: string; password?: string };

/**
 * Why the form came back, with the email as typed so the field still holds
 * it. The password is never sent back. `wrong` is
 * `accounts.sign_in.wrong`; `fields` is `accounts.sign_in.field_errors`.
 */
export type SignInFailed = { email: string; wrong: boolean; fields: FieldErrors };

/** Where the browser keeps the session: the cookie's name, and whether it is `Secure`. */
export type SessionCookie = { name: string; secure: boolean };

/** Each field's first problem, worded. */
const fieldErrors = (problems: Problems): FieldErrors => {
  const fields: FieldErrors = {};
  for (const problem of problems) {
    if (!("field" in problem)) {
      continue;
    }
    if (problem.field === "email" && fields.email === undefined) {
      fields.email = fieldMessage(problem);
    }
    if (problem.field === "password" && fields.password === undefined) {
      fields.password = fieldMessage(problem);
    }
  }
  return fields;
};

/**
 * Whether a refused sign-in is `wrong`, the only refusal the page words.
 * Every other kind is `accounts.error.failed` (`sign-in.md`, Refused): the
 * store or the hasher failed, or the request is one the page would not
 * send. `validation` is skew or a bug, since the BFF checked the input
 * first; `unauthenticated` and `forbidden` are a request that did not come
 * from the page. Every kind must be placed, so a new one does not compile
 * until it is.
 */
const isWrong = (refused: ApiError): boolean => {
  switch (refused.kind) {
    case "invalid_credentials":
      return true;
    case "validation":
    case "unauthenticated":
    case "forbidden":
    case "not_found":
    case "limit":
    case "too_large":
    case "internal":
      return false;
    default: {
      const unplaced: never = refused;
      return unplaced;
    }
  }
};

/**
 * The sign-in page's action: make the form a `SignIn`, ask the api, and
 * keep the token it answers with as the session cookie, until the session's
 * absolute expiry (L40). The cookie is `HttpOnly` and `SameSite=Lax`; the
 * api never writes `Set-Cookie`. A session the request already presented
 * is ended by the api (threats row 3), and the new cookie replaces it.
 *
 * Gives `{ signedIn: true }`, and the route sends the browser to its list;
 * or a failure the page shows; or throws, for `accounts.error.failed`.
 */
export async function signIn(
  api: Pick<Fetcher, "fetch">,
  form: FormData,
  cookies: Pick<Cookies, "set">,
  cookie: SessionCookie,
) {
  const rawEmail = form.get("email");
  let email = "";
  if (typeof rawEmail === "string") {
    email = rawEmail;
  }

  // The input must follow the rules; this saves the person a round trip.
  const input = toSignIn({ email: rawEmail, password: form.get("password") });
  if (!input.ok) {
    const failed: SignInFailed = { email, wrong: false, fields: fieldErrors(input.error) };
    return fail(422, failed);
  }

  const reply = await postSession(api, input.value);
  if (!reply.ok) {
    if (isWrong(reply.error)) {
      const failed: SignInFailed = { email, wrong: true, fields: {} };
      return fail(401, failed);
    }
    throw new Error("sign-in failed", { cause: reply.error });
  }

  cookies.set(cookie.name, reply.data.token, {
    path: "/",
    httpOnly: true,
    secure: cookie.secure,
    sameSite: "lax",
    expires: new Date(reply.data.expiresAt),
  });
  return { signedIn: true as const };
}
