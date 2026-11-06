import type { RuleId } from "@todo/business/rules.ts";
import { type EndpointKey, endpoints } from "@todo/contract-api";
import { type ErrorHandler, type Handler, Hono, type MiddlewareHandler, type NotFoundHandler } from "hono";

/** A validator from `valid`: it carries the ids of the rules it applies, as data (L33). */
export type Validator = ((candidate: never) => unknown) & { readonly rules: readonly RuleId[] };

/**
 * One api route as data: the entry point aimed at it, its exported name, the
 * unit it runs, and the validator its handler is given, under its name. What
 * the route applies is read from that validator, so it is written once, by
 * the generator (L33). A probe runs no unit, so its `unit` is `null` (L20);
 * a handler given no validator has `validator` `null`. The method and path
 * are not here: they are the route's key, as the spec writes them.
 */
export type Route = {
  name: string;
  unit: string | null;
  validator: { name: string; value: Validator } | null;
  handler: Handler;
};

/**
 * Every route, keyed by its endpoint in the contract. A route the spec does
 * not list, or an endpoint with no route, does not compile: the path is
 * written once, in the spec.
 */
export type Routes = Record<EndpointKey, Route>;

/** The gates, one per place, in the order they run (L38). */
export type Gates = [
  requestId: MiddlewareHandler,
  bodyLimit: MiddlewareHandler,
  channel: MiddlewareHandler,
  authenticate: MiddlewareHandler,
];

/** Everything the HTTP layer serves, as construct builds it. */
export type Api = {
  gates: Gates;
  routes: Routes;
  notFound: NotFoundHandler;
  onError: ErrorHandler;
};

/** The spec writes a path parameter in braces, `/todos/{id}`; Hono reads `/todos/:id`. */
const honoPath = (specPath: string) => {
  const translated = specPath.replace(/\{(\w+)\}/g, ":$1");
  return translated;
};

/**
 * Wires the api to Hono, once per isolate. On each request the gates run
 * first, in order, before routing; then the route's entry point takes over.
 * Routes are registered in the order construct lists them.
 */
export const serve = (api: Api): Hono => {
  const app = new Hono();
  for (const gate of api.gates) {
    app.use(gate);
  }
  for (const [key, route] of Object.entries(api.routes)) {
    const endpoint = endpoints[key as EndpointKey];
    app.on(endpoint.method, honoPath(endpoint.path), route.handler);
  }
  app.notFound(api.notFound);
  app.onError(api.onError);
  return app;
};
