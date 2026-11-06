import type { CaughtError } from "@sveltejs/kit/hooks";

/**
 * The words of the shell's views (`feature-accounts-shell.md`, Views),
 * written once for the components and the tests that hold them.
 */

/** `accounts.shell.signed_out`, in place of the list. */
export const SIGNED_OUT = "Sign in to see your list. Your to-dos are kept with your account.";

/** `accounts.shell.signed_out_notice`, above `signed_out`, after a sign-out. */
export const SIGNED_OUT_NOTICE = "You’re signed out on this device.";

/** Back to the list, from any error. */
export const HOME = "Go to your to-dos";

/** Asks for the page again: its own read, or `failed` again. */
export const RETRY = "Try again";

/** An error view: its code line, title and sentence, and whether it offers "Try again". */
export type ErrorView = { code: string; title: string; body: string; retry: boolean };

/** `accounts.error.not_found`: no page has that path. */
export const NOT_FOUND: ErrorView = {
  code: "404",
  title: "This page doesn’t exist",
  body: "The address may be mistyped, or the page has moved.",
  retry: false,
};

/** `accounts.error.failed`: a read the page needs failed. */
export const FAILED: ErrorView = {
  code: "Error",
  title: "Something went wrong",
  body: "That didn’t go through — nothing was changed. Try again.",
  retry: true,
};

/**
 * The view for an error's status. Only 404 has its own; every other
 * status is `failed`. `forbidden` and `admin_only` are added in D, with
 * the pages that can produce them.
 */
export const errorView = (status: number): ErrorView => {
  if (status === 404) {
    return NOT_FOUND;
  }
  return FAILED;
};

/**
 * The one funnel for errors (`handleError`, on the server and the client):
 * whatever was caught, the app's `error()`, SvelteKit's own (a 404),
 * validation, or a fault, becomes the view for its status, and
 * `+error.svelte` only draws `page.error.view`. A fault is a 500.
 */
export const shellError = (caught: CaughtError): App.Error => {
  let status: number;
  switch (caught.kind) {
    case "app":
    case "framework":
    case "validation":
      status = caught.error.status;
      break;
    case "unknown":
      status = 500;
      break;
    default: {
      const unplaced: never = caught;
      return unplaced;
    }
  }
  const view = errorView(status);
  return { status, message: view.title, view };
};
