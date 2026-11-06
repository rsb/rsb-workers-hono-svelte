import { SessionReply, envelope, success } from "@todo/contract-api";
import { env, exports } from "cloudflare:workers";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { ADMIN, MEMBER, fetchAs } from "./signed-in.ts";

/**
 * `GET /sessions/current` on the real Worker: the actor and the profile
 * come from the gate's one statement on the identity database, read by a
 * bearer session as a client that is not the BFF reads it, and by no
 * session at all.
 */

const current = (init?: RequestInit) => exports.default.fetch("https://todo-api/sessions/current", init);

describe("GET /sessions/current, on the identity database", () => {
  it("answers the member's bearer session with the member and their profile", async () => {
    const response = await fetchAs(MEMBER, "https://todo-api/sessions/current");

    expect(response.status).toBe(200);
    expect(v.parse(envelope(SessionReply), await response.json())).toEqual({
      ok: true,
      data: {
        user: { id: MEMBER.userId, role: "member", emailVerified: false, name: MEMBER.userId, email: `${MEMBER.userId}@example.com` },
        clearCookie: false,
      },
    });
  });

  it("answers the admin's with the admin's role", async () => {
    const response = await fetchAs(ADMIN, "https://todo-api/sessions/current");

    expect(v.parse(success(SessionReply), await response.json()).data.user).toMatchObject({ id: ADMIN.userId, role: "admin" });
  });

  it("answers no session as anonymous", async () => {
    const response = await current();

    expect(v.parse(envelope(SessionReply), await response.json())).toEqual({ ok: true, data: { clearCookie: false } });
  });

  it("answers a cookie that names no live session as anonymous, and says to clear it", async () => {
    const response = await current({ headers: { Cookie: `${env.SESSION_COOKIE}=${"n".repeat(43)}` } });

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(v.parse(envelope(SessionReply), await response.json())).toEqual({ ok: true, data: { clearCookie: true } });
  });
});
