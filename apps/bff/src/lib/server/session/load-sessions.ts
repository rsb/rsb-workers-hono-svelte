import type { ApiError, DeviceSessionReply } from "@todo/contract-api";
import { ACTIVE_NOW, UNKNOWN_DEVICE, devicesLine, lastActive } from "#lib/profile.ts";
import { getSessions } from "../api/sessions.ts";

/** One session as the Sessions section draws it: its words, worded here, where `now` is known. */
export type SessionRow = {
  id: string;
  label: string;
  /** The city, when the sign-in's request carried one, then last active: "Lisbon · Active in the last day". */
  detail: string;
  thisDevice: boolean;
  /** Drawn with a phone, not a laptop. From the label, display only. */
  phone: boolean;
};

/**
 * The profile page's data: the Sessions section, or the shell's
 * `signed_out` when the runner refused the read as `unauthenticated`.
 */
export type ProfilePage = { state: "sessions"; line: string; rows: SessionRow[] } | { state: "signed_out" };

/** The systems the label table names for a phone (`device-label.ts`). */
const PHONE = / on (iOS|Android)$/;

const row = (session: DeviceSessionReply, now: number): SessionRow => {
  const label = session.label ?? UNKNOWN_DEVICE;
  let active = lastActive(session.touchedAt, now);
  if (session.thisDevice) {
    active = ACTIVE_NOW;
  }
  let detail = active;
  if (session.city !== undefined) {
    detail = `${session.city} · ${active}`;
  }
  return { id: session.id, label, detail, thisDevice: session.thisDevice, phone: PHONE.test(label) };
};

/**
 * Whether a refused read is the shell's `signed_out`. `listSessions`
 * requires a member, so an anonymous actor is refused `unauthenticated`
 * before anything is read; every other kind is `accounts.error.failed`.
 * Every kind must be placed, so a new one does not compile until it is.
 */
const isSignedOut = (refused: ApiError): boolean => {
  switch (refused.kind) {
    case "unauthenticated":
      return true;
    case "invalid_credentials":
    case "validation":
    case "forbidden":
    case "not_found":
    case "limit":
    case "too_large":
    case "internal":
      return false;
    default: {
      const unplaced: never = refused;
      return unplaced;
    }
  }
};

/**
 * `/profile`: the actor's live sessions, in one read (L51), worded. This
 * device comes first, as the board draws it; the rest keep the api's
 * order, most recently touched first. A failed read is thrown, as a 500,
 * for the shell's `accounts.error.failed` (`list-sessions.md`, Refused).
 */
export async function loadSessions(api: Pick<Fetcher, "fetch">, now: number): Promise<ProfilePage> {
  const reply = await getSessions(api);
  if (!reply.ok) {
    if (isSignedOut(reply.error)) {
      return { state: "signed_out" };
    }
    throw new Error("a read the profile page needs failed", { cause: reply.error });
  }

  const { sessions, more } = reply.data;
  const ordered = [...sessions.filter((session) => session.thisDevice), ...sessions.filter((session) => !session.thisDevice)];
  return { state: "sessions", line: devicesLine(sessions.length, more), rows: ordered.map((session) => row(session, now)) };
}
