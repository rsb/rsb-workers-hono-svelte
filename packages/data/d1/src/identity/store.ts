import { sessionStore } from "./sessions.ts";
import { userStore } from "./users.ts";

/**
 * Every identity database method, in one flat object, as `createDbStore` is
 * for the app database (L42). The two stores take different databases, so
 * neither can reach the other's tables, and a read across them is composed
 * by id, never joined.
 *
 * It only holds `db`, so building it is cheap. Two tables must not give a
 * method the same name: the later one would replace the earlier.
 */
export const createIdentityStore = (db: D1Database) => ({
  ...sessionStore(db),
  ...userStore(db),
});

export type IdentityStore = ReturnType<typeof createIdentityStore>;
