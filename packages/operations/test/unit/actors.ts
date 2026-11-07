import type { Actor } from "@todo/business/auth/actor.ts";

// The actors the operation tests run as. Each todo operation requires a
// member and hands the store their own scope (`prd/todo/access.md`).

export const anonymous: Actor = { kind: "anonymous" };
export const member: Actor = { kind: "user", userId: "u1", role: "member", emailVerified: false, sessionId: "s1" };
export const admin: Actor = { kind: "user", userId: "u-admin", role: "admin", emailVerified: true, sessionId: "s-admin" };

/** The scope the runner hands an operation run as `member`. */
export const own = { ownerId: "u1" };
