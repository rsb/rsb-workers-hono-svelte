import { describe, expect, it } from "vitest";
import { currentSession } from "../../../src/auth/current-session.ts";
import { anonymous, member } from "../actors.ts";

describe("currentSession", () => {
  const profile = { name: "Ada Lovelace", email: "ada@example.com" };

  it("gives the actor, their profile and the gate's clearCookie", async () => {
    expect(await currentSession()(member, { profile, clearCookie: false })).toEqual({
      ok: true,
      value: { actor: member, profile, clearCookie: false },
    });
  });

  it("runs for an anonymous actor, who has no profile, and passes clearCookie on", async () => {
    expect(await currentSession()(anonymous, { profile, clearCookie: true })).toEqual({
      ok: true,
      value: { actor: anonymous, profile: undefined, clearCookie: true },
    });
  });
});
