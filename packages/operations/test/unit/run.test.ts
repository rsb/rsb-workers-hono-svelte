import type { AccessRow } from "@todo/business/access.ts";
import type { Actor } from "@todo/business/auth/actor.ts";
import { ok } from "@todo/business/result.ts";
import { describe, expect, it } from "vitest";
import { operationOf, run, verdict } from "../../src/run.ts";
import { admin, anonymous, member, own } from "./actors.ts";

// The runner (L39, L43). `verdict` is tested over every `Requires` and
// `Scope`, the ones no operation uses yet included; `run` is tested on a
// real row. That every built operation is wrapped under its own row is
// the api's dynamic access test, over construct.

const row = (requires: AccessRow["requires"], scope: AccessRow["scope"]): AccessRow => ({
  useCase: "use-cases/x.md",
  requires,
  scope,
});

const verified: Actor = { kind: "user", userId: "u1", role: "member", emailVerified: true };

describe("verdict", () => {
  it("refuses an anonymous actor below the row as unauthenticated", () => {
    for (const requires of ["member", "verified_member", "admin"] as const) {
      expect(verdict("op", row(requires, "own"), anonymous)).toMatchObject({
        ok: false,
        error: { kind: "unauthenticated", message: "op requires a signed-in user" },
      });
    }
  });

  it("refuses a signed-in actor below the row as forbidden, reason role", () => {
    expect(verdict("op", row("verified_member", "own"), member)).toMatchObject({
      ok: false,
      error: { kind: "forbidden", reason: "role", message: "op requires verified_member" },
    });
    expect(verdict("op", row("admin", "any"), verified)).toMatchObject({
      ok: false,
      error: { kind: "forbidden", reason: "role", message: "op requires admin" },
    });
  });

  it("lets an actor at or above the row through", () => {
    expect(verdict("op", row("member", "own"), member)).toEqual({ ok: true, value: own });
    expect(verdict("op", row("member", "own"), admin)).toEqual({ ok: true, value: { ownerId: "u-admin" } });
    expect(verdict("op", row("verified_member", "own"), verified)).toEqual({ ok: true, value: own });
    expect(verdict("op", row("admin", "any"), admin)).toEqual({ ok: true, value: { any: true } });
  });

  it("hands an n/a row the actor, any actor, anonymous included", () => {
    for (const actor of [anonymous, member, admin]) {
      expect(verdict("op", row("anonymous", "n/a"), actor)).toEqual({ ok: true, value: actor });
    }
  });
});

describe("run", () => {
  it("hands the body the actor's scope and the arguments, after the actor", async () => {
    const given: unknown[] = [];
    const listTodos = run("listTodos", async (scope, filter: { completed?: boolean }) => {
      given.push(scope, filter);
      return ok([]);
    });

    expect(await listTodos(member, { completed: true })).toEqual({ ok: true, value: [] });
    expect(given).toEqual([own, { completed: true }]);
  });

  it("refuses before the body, which never runs", async () => {
    let ran = false;
    const listTodos = run("listTodos", async () => {
      ran = true;
      return ok([]);
    });

    expect(await listTodos(anonymous)).toMatchObject({ ok: false, error: { kind: "unauthenticated" } });
    expect(ran).toBe(false);
  });

  it("names what it built after its row, and nothing else", () => {
    const built = run("countTodos", async () => ok(0));

    expect(operationOf(built)).toBe("countTodos");
    expect(operationOf(async () => ok(0))).toBeUndefined();
  });
});
