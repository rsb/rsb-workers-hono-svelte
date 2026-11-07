import type { Actor } from "@todo/business/auth/actor.ts";
import type { Own } from "@todo/business/auth/scope.ts";
import type { ListedSession, SessionList } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, wrap } from "@todo/fail/fail.ts";
import { run } from "../run.ts";

/**
 * What listing sessions needs from the identity store: the owner's live
 * sessions, most recently touched first, up to `SESSIONS_LIST_MAX`, and
 * whether more were left out (`data/identity.md › sessions.list`).
 */
export type ListSessionsStore = {
  listSessions(scope: Own, input: { now: number }): Promise<Result<SessionList, AnyFail>>;
};

/** One live session as the Sessions section shows it: the store's row, and whether it is this device. */
export type DeviceSession = ListedSession & { thisDevice: boolean };

/** The actor's live sessions, and whether the bound left some out. */
export type DeviceSessions = { sessions: DeviceSession[]; more: boolean };

export type ListSessions = (actor: Actor, sessionId: string) => Promise<Result<DeviceSessions, AnyFail>>;

/**
 * Lists the actor's live sessions and marks the one the request presented
 * as this device (L51). `sessionId` is the actor's, which the delivery
 * passes on: the runner hands an `own` body the scope, never the actor.
 * The store does not know which session is this one; this operation does.
 *
 * Use case: `prd/todo/use-cases/auth/list-sessions.md`
 */
export const listSessions = (deps: { identityStore: ListSessionsStore; now: () => number }): ListSessions =>
  run("listSessions", async (scope, sessionId) => {
    const listed = await deps.identityStore.listSessions(scope, { now: deps.now() });
    if (!listed.ok) {
      return err(wrap(listed.error, "list sessions"));
    }
    const sessions = listed.value.sessions.map((session) => ({ ...session, thisDevice: session.id === sessionId }));
    return ok({ sessions, more: listed.value.more });
  });
