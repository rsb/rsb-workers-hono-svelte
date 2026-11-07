import type { Actor } from "@todo/business/auth/actor.ts";

/**
 * The id of the session the actor came by (L51: this device is the actor's
 * session id). The route answers an anonymous actor before its handler, and
 * the unit refuses one again, so the empty id given for one never reaches
 * a store.
 */
export const sessionIdOf = (actor: Actor): string => (actor.kind === "user" ? actor.sessionId : "");
