import { BODY_LIMIT_BYTES } from "@todo/contract-api";
import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit as honoBodyLimit } from "hono/body-limit";

/**
 * The second gate (L38, binding only): a body over `BODY_LIMIT_BYTES` is
 * refused before anything reads it, with the reply `tooLarge` writes.
 */
export const bodyLimit = (tooLarge: (c: Context) => Response): MiddlewareHandler => {
  return honoBodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: tooLarge });
};
