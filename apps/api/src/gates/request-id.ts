import type { MiddlewareHandler } from "hono";
import { consoleLog } from "../log.ts";

/**
 * The first gate (L38, binding only): mints the request's id and binds the
 * log to it, so every line the request writes carries it.
 */
export const requestId: MiddlewareHandler = async (c, next) => {
  const id = crypto.randomUUID();
  c.set("requestId", id);
  c.set("log", consoleLog(id));
  await next();
};
