import { todoStore } from "./todos.ts";

/**
 * Every database method, in one flat object: each table's file adds its
 * own. It names no operation's port; each operation declares the methods it
 * needs, and construct checks that this fits them (dependency inversion).
 *
 * It only holds `db`, so building it is cheap. Two tables must not give a
 * method the same name: the later one would replace the earlier.
 */
export const createDbStore = (db: D1Database) => ({
  ...todoStore(db),
});

export type DbStore = ReturnType<typeof createDbStore>;
