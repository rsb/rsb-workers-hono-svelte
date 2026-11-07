import { describe, expect, it } from "vitest";
import { ACTIVE_NOW, EVERYWHERE_NOTE, UNKNOWN_DEVICE, devicesLine, lastActive } from "../../../src/lib/profile.ts";
import { loadSessions } from "../../../src/lib/server/session/load-sessions.ts";

/** A fake binding that answers once, and records what it was asked. */
const binding = (status: number, body: unknown) => {
  const asked: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    asked.push({ url, init });
    return Response.json(body, { status });
  };
  return { api: { fetch } as Pick<Fetcher, "fetch">, asked };
};

const listed = (sessions: unknown[], more = false) => binding(200, { ok: true, data: { sessions, more } });

const refused = (kind: string, status: number) => binding(status, { ok: false, error: { kind, message: "for developers" } });

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 6, 12);

describe("loadSessions", () => {
  it("reads the actor's sessions once, and words each one, this device first", async () => {
    const { api, asked } = listed([
      { id: "phone", label: "Safari on iOS", city: "Lisbon", createdAt: 0, touchedAt: NOW - 3 * HOUR, thisDevice: false },
      { id: "here", label: "Firefox on Linux", city: "Lisbon", createdAt: 0, touchedAt: NOW - 11 * HOUR, thisDevice: true },
      { id: "old", createdAt: 0, touchedAt: NOW - 3 * DAY - HOUR, thisDevice: false },
    ]);

    const page = await loadSessions(api, NOW);

    expect(asked).toHaveLength(1);
    expect(asked[0]?.url).toBe("https://todo-api/sessions");
    expect(asked[0]?.init?.method ?? "GET").toBe("GET");
    expect(page).toEqual({
      state: "sessions",
      line: "Signed in on 3 devices.",
      rows: [
        { id: "here", label: "Firefox on Linux", detail: "Lisbon · Active now", thisDevice: true, phone: false },
        { id: "phone", label: "Safari on iOS", detail: "Lisbon · Active in the last day", thisDevice: false, phone: true },
        { id: "old", label: UNKNOWN_DEVICE, detail: "Active 3 days ago", thisDevice: false, phone: false },
      ],
    });
  });

  it("draws an Android session with a phone, and says nothing of a city it was not given", async () => {
    const { api } = listed([{ id: "a", label: "Chrome on Android", createdAt: 0, touchedAt: NOW, thisDevice: true }]);

    const page = await loadSessions(api, NOW);

    expect(page).toMatchObject({ rows: [{ detail: ACTIVE_NOW, phone: true }] });
  });

  it("says the count stopped at the bound when more were live", async () => {
    const { api } = listed([{ id: "a", createdAt: 0, touchedAt: NOW, thisDevice: true }], true);

    const page = await loadSessions(api, NOW);

    expect(page).toMatchObject({ line: "Signed in on more than 1 devices. The 1 most recently active are listed." });
  });

  it("is the shell's signed_out when the runner refuses an anonymous actor", async () => {
    expect(await loadSessions(refused("unauthenticated", 401).api, NOW)).toEqual({ state: "signed_out" });
  });

  // `list-sessions.md`, Refused: the page's load fails.
  it.each([
    ["internal", 500],
    ["forbidden", 403],
    ["validation", 422],
  ])("throws, for accounts.error.failed, when the api answers %s", async (kind, status) => {
    await expect(loadSessions(refused(kind, status).api, NOW)).rejects.toThrow("a read the profile page needs failed");
  });

  it("throws when the api cannot be read", async () => {
    await expect(loadSessions(binding(200, "not an envelope").api, NOW)).rejects.toThrow();
  });
});

describe("devicesLine", () => {
  it.each([
    [1, false, "Signed in on 1 device."],
    [2, false, "Signed in on 2 devices."],
    [50, true, "Signed in on more than 50 devices. The 50 most recently active are listed."],
  ] as const)("words %i listed, more %s", (count, more, words) => {
    expect(devicesLine(count, more)).toBe(words);
  });
});

// Day words, not hours (L51): a touch writes at most once per 12 hours.
describe("lastActive", () => {
  it.each([
    [0, "Active in the last day"],
    [DAY - 1, "Active in the last day"],
    [DAY, "Active 1 day ago"],
    [2 * DAY - 1, "Active 1 day ago"],
    [2 * DAY, "Active 2 days ago"],
    [3 * DAY + 5 * HOUR, "Active 3 days ago"],
  ])("words a touch %i ms before now", (before, words) => {
    expect(lastActive(NOW - before, NOW)).toBe(words);
  });

  it("is the last day for a touch a skewed clock puts after now", () => {
    expect(lastActive(NOW + HOUR, NOW)).toBe("Active in the last day");
  });
});

describe("the section's words", () => {
  it("says what Sign out everywhere does to this device, with the board's words", () => {
    expect(EVERYWHERE_NOTE).toBe("Includes this device. You’ll need to sign in again.");
  });
});
