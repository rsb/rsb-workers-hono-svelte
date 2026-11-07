import type { Actor } from "@todo/business/auth/actor.ts";
import { err, ok } from "@todo/business/result.ts";
import { DeviceSessionListReply, SignedOutReply, envelope } from "@todo/contract-api";
import { unavailable } from "@todo/fail/fail.ts";
import type { ListSessions } from "@todo/operations/auth/list-sessions.ts";
import type { SignOutEverywhere } from "@todo/operations/auth/sign-out-everywhere.ts";
import type { SignOut } from "@todo/operations/auth/sign-out.ts";
import { Context } from "hono";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { deleteCurrentSession } from "../../../../../src/app/handlers/sessions/delete-current-session.ts";
import { deleteSessions } from "../../../../../src/app/handlers/sessions/delete-sessions.ts";
import { getSessions } from "../../../../../src/app/handlers/sessions/get-sessions.ts";
import { member } from "../actor.ts";

/** A request with the actor the gate attached already on it. */
const request = (method: string, path: string, actor: Actor = member) => {
  const c = new Context(new Request(`https://todo-api${path}`, { method }));
  c.set("actor", actor);
  return c;
};

describe("deleteCurrentSession", () => {
  it("ends the session the actor came by and answers that it holds", async () => {
    const asked: string[] = [];
    const signOut: SignOut = async (_, sessionId) => {
      asked.push(sessionId);
      return ok(undefined);
    };

    const response = await deleteCurrentSession(signOut)(request("DELETE", "/sessions/current"));

    expect(response.status).toBe(200);
    expect(v.parse(envelope(SignedOutReply), await response.json())).toEqual({ ok: true, data: { signedOut: true } });
    expect(asked).toEqual(["s1"]);
  });

  it("answers a store failure as internal", async () => {
    const signOut: SignOut = async () => err(unavailable("sign out: D1_ERROR"));
    const response = await deleteCurrentSession(signOut)(request("DELETE", "/sessions/current"));
    expect(response.status).toBe(500);
  });
});

describe("deleteSessions", () => {
  it("signs the actor out everywhere and answers that it holds", async () => {
    const actors: Actor[] = [];
    const signOutEverywhere: SignOutEverywhere = async (actor) => {
      actors.push(actor);
      return ok(undefined);
    };

    const response = await deleteSessions(signOutEverywhere)(request("DELETE", "/sessions"));

    expect(v.parse(envelope(SignedOutReply), await response.json())).toEqual({ ok: true, data: { signedOut: true } });
    expect(actors).toEqual([member]);
  });
});

describe("getSessions", () => {
  it("presents each session, leaving out a label or city the request did not give, and passes more on", async () => {
    const asked: string[] = [];
    const listSessions: ListSessions = async (_, sessionId) => {
      asked.push(sessionId);
      return ok({
        sessions: [
          { id: "s1", label: "Firefox on Linux", city: "Lisbon", createdAt: 1, touchedAt: 3, thisDevice: true },
          { id: "s2", label: null, city: null, createdAt: 2, touchedAt: 2, thisDevice: false },
        ],
        more: true,
      });
    };

    const response = await getSessions(listSessions)(request("GET", "/sessions"));

    expect(response.status).toBe(200);
    expect(v.parse(envelope(DeviceSessionListReply), await response.json())).toEqual({
      ok: true,
      data: {
        sessions: [
          { id: "s1", label: "Firefox on Linux", city: "Lisbon", createdAt: 1, touchedAt: 3, thisDevice: true },
          { id: "s2", createdAt: 2, touchedAt: 2, thisDevice: false },
        ],
        more: true,
      },
    });
    expect(asked).toEqual(["s1"]);
  });
});
