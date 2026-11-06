/** A user's role. Every user is a member; an admin is a member who may run admin operations. */
export type Role = "member" | "admin";

/**
 * Who a request acts for (L39). The `authenticate` gate attaches it to every
 * request; the runner checks it against `access.md`'s row before an
 * operation's body runs. It holds what authorization needs, and the id of
 * the session the request came by: sign-in ends it (rotation), sign-out
 * ends it, and the Sessions page marks it as this device (L49 to L51). The
 * name and email the frame shows are the `Profile`, beside it.
 */
export type Actor =
  | { kind: "anonymous" }
  | { kind: "user"; userId: string; role: Role; emailVerified: boolean; sessionId: string };

/** The actor of a request with no live session. */
export const anonymous: Actor = { kind: "anonymous" };

/** What the frame shows of a signed-in user, read by the gate's one statement. */
export type Profile = { name: string; email: string };
