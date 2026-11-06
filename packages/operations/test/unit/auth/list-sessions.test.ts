import type { Own } from "@todo/business/auth/scope.ts";
import type { SessionList } from "@todo/business/auth/session.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, rootOf, unavailable } from "@todo/fail/fail.ts";
import { describe, expect, it } from "vitest";
import { listSessions } from "../../../src/auth/list-sessions.ts";
import { member, own } from "../actors.ts";

const NOW = Date.UTC(2026, 10, 6, 12);

const listed = (id: string, touchedAt: number) => ({ id, label: "Firefox on Linux", city: null, createdAt: NOW - 1000, touchedAt });

/** A fake of the port that gives `answer` and records what it was asked. */
const fakeStore = (answer: Result<SessionList, AnyFail>) => {
  const asked: { scope: Own; input: { now: number } }[] = [];
  return {
    asked,
    listSessions: async (scope: Own, input: { now: number }) => {
      asked.push({ scope, input });
      return answer;
    },
  };
};

describe("listSessions", () => {
  it("reads the actor's live sessions at now, in the store's order, and marks the presented one", async () => {
    const identityStore = fakeStore(ok({ sessions: [listed("s2", NOW - 10), listed("s1", NOW - 20)], more: false }));

    const sessions = await listSessions({ identityStore, now: () => NOW })(member, "s1");

    expect(sessions).toEqual({
      ok: true,
      value: {
        sessions: [
          { ...listed("s2", NOW - 10), thisDevice: false },
          { ...listed("s1", NOW - 20), thisDevice: true },
        ],
        more: false,
      },
    });
    expect(identityStore.asked).toEqual([{ scope: own, input: { now: NOW } }]);
  });

  it("passes on that the bound left sessions out, and marks none when this device is among them", async () => {
    const identityStore = fakeStore(ok({ sessions: [listed("s2", NOW - 10)], more: true }));

    const sessions = await listSessions({ identityStore, now: () => NOW })(member, "s1");

    expect(sessions).toEqual({ ok: true, value: { sessions: [{ ...listed("s2", NOW - 10), thisDevice: false }], more: true } });
  });

  it("wraps the store's failure, keeping its kind and root", async () => {
    const down = unavailable("list sessions: D1_ERROR: Network connection lost.");

    const sessions = await listSessions({ identityStore: fakeStore(err(down)), now: () => NOW })(member, "s1");

    expect(sessions).toMatchObject({ ok: false, error: { kind: "unavailable" } });
    expect(!sessions.ok && rootOf(sessions.error)).toBe(down);
  });
});
