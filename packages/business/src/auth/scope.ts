/**
 * What an operation hands the store (L43): which rows a call may read or
 * write. The store has no default; every call that touches an owned row
 * takes one. The runner works it out from the actor and the operation's
 * row in `access.md`; an operation's body never builds one.
 */

/** The actor's own rows: `access.md`'s `own`. */
export type Own = { ownerId: string };

/** Every row: `access.md`'s `any`, for an admin. No operation is handed it until slice D. */
export type Any = { any: true };

/** A scope a read, an update or a delete is given. An insert takes `Own`: a new row needs an owner. */
export type Scope = Own | Any;
