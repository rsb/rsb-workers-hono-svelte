import type { ErrorHandler } from "hono";
import { failure } from "../respond.ts";

/** The cause goes to the log, never into the response. */
export const onError: ErrorHandler = (err, c) => {
  console.error("internal error", err);
  return failure(c, "internal", "internal error");
};
