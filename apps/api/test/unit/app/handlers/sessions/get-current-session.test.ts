import { Failure, SessionReply, envelope } from "@todo/contract-api";
import type { Actor, Profile } from "@todo/business/auth/actor.ts";
import { err } from "@todo/business/result.ts";
import { serverFault } from "@todo/fail/fail.ts";
import { currentSession } from "@todo/operations/auth/current-session.ts";
import { Context } from "hono";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { getCurrentSession } from "../../../../../src/app/handlers/sessions/get-current-session.ts";
import { member } from "../actor.ts";

/** A request with what the `authenticate` gate attaches already on it. */
const get = (actor: Actor, profile: Profile | undefined, clearCookie = false) => {
  const c = new Context(new Request("https://todo-api/sessions/current"));
  c.set("actor", actor);
  c.set("profile", profile);
  c.set("clearCookie", clearCookie);
  return c;
};

const ada: Profile = { name: "Ada Lovelace", email: "ada@example.com" };

describe("getCurrentSession", () => {
  it("presents a signed-in actor as the user, with the profile", async () => {
    const response = await getCurrentSession(currentSession())(get(member, ada));

    expect(response.status).toBe(200);
    expect(v.parse(envelope(SessionReply), await response.json())).toEqual({
      ok: true,
      data: {
        user: { id: "u1", role: "member", emailVerified: false, name: "Ada Lovelace", email: "ada@example.com" },
        clearCookie: false,
      },
    });
  });

  it("presents an anonymous actor as no user, passing clearCookie on", async () => {
    const response = await getCurrentSession(currentSession())(get({ kind: "anonymous" }, undefined, true));

    expect(v.parse(envelope(SessionReply), await response.json())).toEqual({ ok: true, data: { clearCookie: true } });
  });

  it("answers internal, and logs, when a signed-in actor has no profile", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await getCurrentSession(currentSession())(get(member, undefined));

    expect(response.status).toBe(500);
    expect(v.parse(Failure, await response.json()).error).toEqual({ kind: "internal", message: "internal error" });
    expect(String(logged.mock.calls[0]?.[0])).toContain("the gate attached user u1 with no profile");
  });

  it("answers what the operation fails with", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await getCurrentSession(async () => err(serverFault("down")))(get(member, ada));

    expect(response.status).toBe(500);
  });
});
