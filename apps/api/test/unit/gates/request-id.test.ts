import { err } from "@todo/business/result.ts";
import { unavailable } from "@todo/fail/fail.ts";
import { describe, expect, it, vi } from "vitest";
import { fakeDbStore } from "../fake-db-store.ts";
import { MEMBER, signedIn } from "../signed-in.ts";

// The `requestId` gate (L38) binds the log to the request, so a server
// failure is one JSON line naming the request: `{ requestId, method, path,
// kind, message, chain }`.

const failingList = () => {
  const store = fakeDbStore();
  store.listTodos = async () => err(unavailable("D1 is down", new Error("D1_ERROR: network lost")));
  return store;
};

describe("a server failure's log line", () => {
  it("names the request, the failure and what it wraps", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: string) => {
      lines.push(line);
    });

    const response = await signedIn(MEMBER, { dbStore: failingList() }).request("/todos?completed=false");

    expect(response.status).toBe(500);
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0] ?? "");
    expect(Object.keys(line)).toEqual(["requestId", "method", "path", "kind", "message", "chain"]);
    expect(line).toMatchObject({ method: "GET", path: "/todos", kind: "unavailable" });
    expect(line.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(line.message).toContain("D1 is down");
    expect(line.chain.at(-1)).toContain("D1_ERROR: network lost");
  });

  it("names a new id for each request", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: string) => {
      lines.push(line);
    });
    const api = signedIn(MEMBER, { dbStore: failingList() });

    await api.request("/todos");
    await api.request("/todos");

    const [first, second] = lines.map((line) => JSON.parse(line).requestId);
    expect(first).not.toBe(second);
  });
});
