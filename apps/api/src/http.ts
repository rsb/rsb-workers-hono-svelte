import { BODY_LIMIT_BYTES } from "@todo/contract-api";
import { type Context, type ErrorHandler, type Handler, Hono, type NotFoundHandler } from "hono";
import { bodyLimit } from "hono/body-limit";

/** One api route: a method, a path, and the entry point aimed at it. */
export type Route = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; handler: Handler };

/** Everything the HTTP layer serves, as construct builds it. */
export type Api = {
  routes: readonly Route[];
  notFound: NotFoundHandler;
  tooLarge: (c: Context) => Response;
  onError: ErrorHandler;
};

/**
 * Wires the api to Hono, once per isolate. On each request the body limit
 * runs first, before routing; then the route's entry point takes over.
 */
export const serve = (api: Api): Hono => {
  const app = new Hono();
  app.use(bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: api.tooLarge }));
  for (const route of api.routes) app.on(route.method, route.path, route.handler);
  app.notFound(api.notFound);
  app.onError(api.onError);
  return app;
};
