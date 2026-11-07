import type { DbStore } from "@todo/data-d1/store.ts";
import type { IdentityStore } from "@todo/data-d1/identity/store.ts";
import type { Hasher } from "@todo/operations/auth/sign-in.ts";
import type { Config } from "../../src/config.ts";
import { type Infra, constructApi, constructGates, constructOperations, constructRoutes } from "../../src/construct.ts";
import { serve } from "../../src/http.ts";
import { fakeDbStore } from "./fake-db-store.ts";
import { fakeHasher } from "./fake-hasher.ts";
import { fakeIdentityStore } from "./fake-identity-store.ts";

/** The fixed clock every unit test of the whole api runs at. */
export const NOW = Date.UTC(2026, 10, 5, 12);

/** The config the tests run with: the BFF's origin, the cookie as local dev names it, and a pepper no hasher here reads. */
export const config: Config = { bffOrigin: "https://todo.test", sessionCookie: "sid", peppers: { 1: "unit-test-pepper-not-a-secret-00000001" } };

/** A digest that is plainly not SHA-256, so a test can name a session's hash. */
export const digest = async (token: string) => `hash:${token}`;

/** The token every sign-in in a unit test mints: 43 characters, as `TOKEN_PATTERN` takes. */
export const TEST_TOKEN = "n".repeat(43);

/**
 * The whole api, gates and route table, on fake stores, entered below
 * `constructInfra` (A10): no workerd, no database, a fixed clock and, by
 * default, a fixed id.
 */
export const testApi = (
  parts: { dbStore?: DbStore; identityStore?: IdentityStore; hasher?: Hasher; newId?: () => string; now?: () => number } = {},
) => {
  const infra: Infra = {
    dbStore: parts.dbStore ?? fakeDbStore(),
    identityStore: parts.identityStore ?? fakeIdentityStore().store,
    newId: parts.newId ?? (() => "id-1"),
    now: parts.now ?? (() => NOW),
    newToken: () => TEST_TOKEN,
    digest,
    hasher: parts.hasher ?? fakeHasher().hasher,
  };
  const gates = constructGates(infra, config);
  const routes = constructRoutes(constructOperations(infra));
  return serve(constructApi(gates, routes));
};
