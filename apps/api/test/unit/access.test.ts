import { type AccessRow, access } from "@todo/business/access.ts";
import type { Actor } from "@todo/business/auth/actor.ts";
import { err } from "@todo/business/result.ts";
import type { DbStore } from "@todo/data-d1/store.ts";
import { serverFault } from "@todo/fail/fail.ts";
import { operationOf } from "@todo/operations/run.ts";
import { describe, expect, it } from "vitest";
import { type Infra, constructOperations } from "../../src/construct.ts";
import { fakeHasher } from "./fake-hasher.ts";
import { fakeIdentityStore } from "./fake-identity-store.ts";
import { NOW, digest } from "./test-api.ts";

// The dynamic access check (L43): every operation as construct builds it,
// called as anonymous, a member and an admin with no arguments of its own,
// must give the verdict its row in `prd/todo/access.md` gives. The static
// half is `pnpm check:access`: one row per operation, the table generated.
// What a body does with no arguments is not under test; only whether it ran.

const actors: Record<string, Actor> = {
  anonymous: { kind: "anonymous" },
  member: { kind: "user", userId: "u1", role: "member", emailVerified: false },
  admin: { kind: "user", userId: "u-admin", role: "admin", emailVerified: true },
};

type Verdict = "runs" | "unauthenticated" | "forbidden";

/** The verdict the row gives each actor, worked out here, apart from the runner's own. */
const expected = (row: AccessRow, actor: string): Verdict => {
  const levels = ["anonymous", "member", "verified_member", "admin"];
  const reaches = { anonymous: 0, member: 1, admin: 3 }[actor] ?? 0;
  if (levels.indexOf(row.requires) <= reaches) {
    return "runs";
  }
  return actor === "anonymous" ? "unauthenticated" : "forbidden";
};

/** Construct's operations on infra that records every use: a body that ran used some, or gave a result. */
const built = () => {
  const used: string[] = [];
  const dbStore = new Proxy(
    {},
    {
      get: (_, method) => async () => {
        used.push(`dbStore.${String(method)}`);
        return err(serverFault("the store is not under test"));
      },
    },
  ) as DbStore;
  const infra: Infra = {
    dbStore,
    identityStore: fakeIdentityStore().store,
    newId: () => {
      used.push("newId");
      return "id-1";
    },
    now: () => NOW,
    digest,
    hasher: fakeHasher().hasher,
  };
  return { operations: constructOperations(infra), used };
};

describe("access.md and the operations construct builds", () => {
  it("name the same operations", () => {
    expect(Object.keys(built().operations).sort()).toEqual(Object.keys(access).sort());
  });

  it.each(Object.keys(access))("%s is wrapped by the runner under its own row", (name) => {
    const operation = built().operations[name as keyof typeof access];
    expect(operationOf(operation)).toBe(name);
  });
});

const cases = Object.entries(access).flatMap(([name, row]) =>
  Object.keys(actors).map((actor) => [name, actor, expected(row, actor)] as const),
);

describe("each operation's verdict for each actor", () => {
  it.each(cases)("%s as %s: %s", async (name, actor, verdict) => {
    const { operations, used } = built();
    const operation = operations[name as keyof typeof access] as (actor: Actor) => Promise<unknown>;

    let result: unknown;
    let threw = false;
    try {
      result = await operation(actors[actor] as Actor);
    } catch {
      // A body run with no arguments may throw; the runner never does.
      threw = true;
    }

    if (verdict === "runs") {
      const gaveOk = typeof result === "object" && result !== null && (result as { ok?: unknown }).ok === true;
      expect(threw || gaveOk || used.length > 0, `${name} did not run for ${actor}`).toBe(true);
      expect(result).not.toMatchObject({ ok: false, error: { kind: "unauthenticated" } });
      expect(result).not.toMatchObject({ ok: false, error: { kind: "forbidden" } });
      return;
    }
    expect(threw).toBe(false);
    const refusal = verdict === "forbidden" ? { kind: "forbidden", reason: "role" } : { kind: "unauthenticated" };
    expect(result).toMatchObject({ ok: false, error: refusal });
    // Refused before the body: it touched nothing.
    expect(used).toEqual([]);
  });
});
