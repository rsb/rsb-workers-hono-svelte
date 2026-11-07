import type { Own } from "@todo/business/auth/scope.ts";
import type { EndedReason } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, rootOf, unavailable } from "@todo/fail/fail.ts";
import { describe, expect, it } from "vitest";
import { signOut } from "../../../src/auth/sign-out.ts";
import { member, own } from "../actors.ts";

const NOW = Date.UTC(2026, 10, 6, 12);

/** A fake of the sign-out port that gives `answer` and records what it was asked. */
const fakeStore = (answer: Result<boolean, AnyFail>) => {
  const asked: { scope: Own; input: { id: string; reason: EndedReason; now: number } }[] = [];
  return {
    asked,
    endSession: async (scope: Own, input: { id: string; reason: EndedReason; now: number }) => {
      asked.push({ scope, input });
      return answer;
    },
  };
};

describe("signOut", () => {
  it("ends the presented session in the actor's scope, as signed_out, at now", async () => {
    const identityStore = fakeStore(ok(true));

    const signedOut = await signOut({ identityStore, now: () => NOW })(member, "s1");

    expect(signedOut).toEqual({ ok: true, value: undefined });
    expect(identityStore.asked).toEqual([{ scope: own, input: { id: "s1", reason: "signed_out", now: NOW } }]);
  });

  it("is not refused when the session had already ended: what was asked for holds", async () => {
    const signedOut = await signOut({ identityStore: fakeStore(ok(false)), now: () => NOW })(member, "s1");
    expect(signedOut).toEqual({ ok: true, value: undefined });
  });

  it("wraps the store's failure, keeping its kind and root", async () => {
    const down = unavailable("sign out: D1_ERROR: Network connection lost.");

    const signedOut = await signOut({ identityStore: fakeStore(err(down)), now: () => NOW })(member, "s1");

    expect(signedOut).toMatchObject({ ok: false, error: { kind: "unavailable" } });
    expect(!signedOut.ok && rootOf(signedOut.error)).toBe(down);
  });
});
