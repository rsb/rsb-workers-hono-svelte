import { BODY_LIMIT_BYTES } from "@todo/contract";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { notFound, onError, tooLarge } from "./app/handlers/errors/errors.ts";
import { getHealth } from "./app/handlers/health/health.ts";

/** The request path: the body limit runs first, before routing. */
export const createApp = () =>
  new Hono()
    .use(bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: tooLarge }))
    .get("/health", getHealth)
    .notFound(notFound)
    .onError(onError);
