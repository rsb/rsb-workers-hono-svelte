import type { Own } from "@todo/business/auth/scope.ts";
import type { EndedReason } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, rootOf, unavailable } from "@todo/fail/fail.ts";
import { describe, expect, it } from "vitest";
import { signOutEverywhere } from "../../../src/auth/sign-out-everywhere.ts";
import { member, own } from "../actors.ts";

const NOW = Date.UTC(2026, 10, 6, 12);

/** A fake of the port that gives `answer` and records what it was asked. */
const fakeStore = (answer: Result<number, AnyFail>) => {
  const asked: { scope: Own; input: { reason: EndedReason; now: number } }[] = [];
  return {
    asked,
    endAllSessions: async (scope: Own, input: { reason: EndedReason; now: number }) => {
      asked.push({ scope, input });
      return answer;
    },
  };
};

describe("signOutEverywhere", () => {
  it("ends every live session in the actor's scope, as signed_out_everywhere, at now", async () => {
    const identityStore = fakeStore(ok(3));

    const signedOut = await signOutEverywhere({ identityStore, now: () => NOW })(member);

    expect(signedOut).toEqual({ ok: true, value: undefined });
    expect(identityStore.asked).toEqual([{ scope: own, input: { reason: "signed_out_everywhere", now: NOW } }]);
  });

  it("is not refused when there was nothing left to end", async () => {
    const signedOut = await signOutEverywhere({ identityStore: fakeStore(ok(0)), now: () => NOW })(member);
    expect(signedOut).toEqual({ ok: true, value: undefined });
  });

  it("wraps the store's failure, keeping its kind and root", async () => {
    const down = unavailable("sign out everywhere: D1_ERROR: Network connection lost.");

    const signedOut = await signOutEverywhere({ identityStore: fakeStore(err(down)), now: () => NOW })(member);

    expect(signedOut).toMatchObject({ ok: false, error: { kind: "unavailable" } });
    expect(!signedOut.ok && rootOf(signedOut.error)).toBe(down);
  });
});
