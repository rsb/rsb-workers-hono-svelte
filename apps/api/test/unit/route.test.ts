import type { AccessRow } from "@todo/business/access.ts";
import type { Actor } from "@todo/business/auth/actor.ts";
import { type Result, ok } from "@todo/business/result.ts";
import { Failure } from "@todo/contract-api";
import type { AnyFail } from "@todo/fail/fail.ts";
import { type Context, Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { routing } from "../../src/route.ts";

// The route's mirror of the row (L43): the runner's verdict, answered
// before the handler reads the request. A row that requires an admin
// shows both refusals; every row construct has today requires a member.

type Ping = (actor: Actor) => Promise<Result<string, AnyFail>>;

const row: AccessRow = { useCase: "use-cases/x.md", requires: "admin", scope: "n/a" };

/** A route whose handler records that it ran, under an admin's row, with `actor` attached as the gate would. */
const app = (actor: Actor) => {
  const ran: string[] = [];
  const ping: Ping = async () => ok("pong");
  const getPing = (unit: Ping) => async (c: Context) => {
    ran.push("handler");
    const given = await unit(c.get("actor"));
    return c.json(given);
  };
  const { route } = routing<{ ping: Ping }>({ ping: row });
  const built = route({ getPing }, { ping });
  const hono = new Hono();
  hono.use(async (c, next) => {
    c.set("actor", actor);
    await next();
  });
  hono.get("/ping", built.handler);
  return { hono, ran };
};

describe("a route behind its unit's row", () => {
  it("refuses an anonymous actor as unauthenticated, before the handler", async () => {
    const { hono, ran } = app({ kind: "anonymous" });

    const response = await hono.request("/ping");

    expect(response.status).toBe(401);
    expect(v.parse(Failure, await response.json()).error.kind).toBe("unauthenticated");
    expect(ran).toEqual([]);
  });

  it("refuses a signed-in actor below the row as forbidden, reason role, before the handler", async () => {
    const { hono, ran } = app({ kind: "user", userId: "u1", role: "member", emailVerified: true });

    const response = await hono.request("/ping");

    expect(response.status).toBe(403);
    expect(v.parse(Failure, await response.json()).error).toEqual({
      kind: "forbidden",
      reason: "role",
      message: "ping requires admin",
    });
    expect(ran).toEqual([]);
  });

  it("runs the handler for an actor the row lets through", async () => {
    const { hono, ran } = app({ kind: "user", userId: "u-admin", role: "admin", emailVerified: true });

    const response = await hono.request("/ping");

    expect(response.status).toBe(200);
    expect(ran).toEqual(["handler"]);
  });
});
