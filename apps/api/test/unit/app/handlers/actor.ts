import type { Actor } from "@todo/business/auth/actor.ts";
import type { MiddlewareHandler } from "hono";

/** The actor the handler tests attach, as the `authenticate` gate would. */
export const member: Actor = { kind: "user", userId: "u1", role: "member", emailVerified: false, sessionId: "s1" };

/** Attaches `member` before the route, so a handler's unit test sees the actor it passes on. */
export const asMember: MiddlewareHandler = async (c, next) => {
  c.set("actor", member);
  await next();
};
