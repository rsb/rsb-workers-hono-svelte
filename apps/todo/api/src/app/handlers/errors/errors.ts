import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { failure } from "../present.ts";

/** No route matched the request. */
export const notFound: NotFoundHandler = (c) => failure(c, "not_found", "not found");

/** The body limit rejected the request before routing. */
export const tooLarge = (c: Context) => failure(c, "too_large", "request body too large");

/** The cause goes to the log, never into the response. */
export const onError: ErrorHandler = (err, c) => {
  console.error("internal error", err);
  return failure(c, "internal", "internal error");
};
