import type { Context, ErrorHandler, NotFoundHandler } from "hono";
// As a namespace: the handlers here share their names with the failures.
import * as fail from "@todo/fail/fail.ts";
import { serverFailure, userFailure } from "../present.ts";

/** No route matched the request. */
export const notFound: NotFoundHandler = (c) => {
  return userFailure(c, fail.notFound("not found"));
};

/** The body limit rejected the request before routing. */
export const tooLarge = (c: Context) => {
  return userFailure(c, fail.tooLarge("request body too large"));
};

/** A throw is a bug: every expected failure is returned. The cause goes to the log. */
export const onError: ErrorHandler = (err, c) => {
  return serverFailure(c, fail.serverFault("unhandled throw", err));
};
