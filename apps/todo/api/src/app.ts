import { BODY_LIMIT_BYTES } from "@todo/contract";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { onError } from "./handlers/error.ts";
import { notFound } from "./handlers/not-found.ts";
import { tooLarge } from "./handlers/too-large.ts";
import { health } from "./routes/health.ts";

/** The request path: the body limit runs first, before routing. */
export const createApp = () =>
  new Hono()
    .use(bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: tooLarge }))
    .route("/", health)
    .notFound(notFound)
    .onError(onError);
