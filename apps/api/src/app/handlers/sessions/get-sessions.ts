import type { DeviceSessionListReply, DeviceSessionReply } from "@todo/contract-api";
import type { DeviceSession, ListSessions } from "@todo/operations/auth/list-sessions.ts";
import type { Context } from "hono";
import { mapFailure, success } from "../present.ts";
import { sessionIdOf } from "./session-id.ts";

/** One session on the wire: a label or city the request did not give is absent, not null. */
const presentSession = (session: DeviceSession): DeviceSessionReply => ({
  id: session.id,
  ...(session.label === null ? {} : { label: session.label }),
  ...(session.city === null ? {} : { city: session.city }),
  createdAt: session.createdAt,
  touchedAt: session.touchedAt,
  thisDevice: session.thisDevice,
});

/**
 * `GET /sessions`: the actor's live sessions, most recently touched first,
 * at most `SESSIONS_LIST_MAX`, the one the request came by marked (L51).
 * Nothing to validate.
 */
export const getSessions = (listSessions: ListSessions) => async (c: Context) => {
  const actor = c.get("actor");
  const listed = await listSessions(actor, sessionIdOf(actor));
  if (!listed.ok) {
    return mapFailure(c, listed.error);
  }

  const reply: DeviceSessionListReply = { sessions: listed.value.sessions.map(presentSession), more: listed.value.more };
  return success(c, reply);
};
