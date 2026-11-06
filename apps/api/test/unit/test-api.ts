import type { DbStore } from "@todo/data-d1/store.ts";
import type { IdentityStore } from "@todo/data-d1/identity/store.ts";
import type { Config } from "../../src/config.ts";
import { type Infra, constructApi, constructGates, constructOperations, constructRoutes } from "../../src/construct.ts";
import { serve } from "../../src/http.ts";
import { fakeDbStore } from "./fake-db-store.ts";
import { fakeIdentityStore } from "./fake-identity-store.ts";

/** The fixed clock every unit test of the whole api runs at. */
export const NOW = Date.UTC(2026, 10, 5, 12);

/** The config the tests run with: the BFF's origin, and the cookie as local dev names it. */
export const config: Config = { bffOrigin: "https://todo.test", sessionCookie: "sid" };

/** A digest that is plainly not SHA-256, so a test can name a session's hash. */
export const digest = async (token: string) => `hash:${token}`;

/**
 * The whole api, gates and route table, on fake stores, entered below
 * `constructInfra` (A10): no workerd, no database, a fixed clock and, by
 * default, a fixed id.
 */
export const testApi = (
  parts: { dbStore?: DbStore; identityStore?: IdentityStore; newId?: () => string; now?: () => number } = {},
) => {
  const infra: Infra = {
    dbStore: parts.dbStore ?? fakeDbStore(),
    identityStore: parts.identityStore ?? fakeIdentityStore().store,
    newId: parts.newId ?? (() => "id-1"),
    now: parts.now ?? (() => NOW),
    digest,
  };
  const gates = constructGates(infra, config);
  const routes = constructRoutes(constructOperations(infra));
  return serve(constructApi(gates, routes));
};
