import { describe, expect, it } from "vitest";
import { type SignInRow, credentialStore } from "../../../src/identity/credentials.ts";
import { fakeD1 } from "../fake-d1.ts";

const NOW = Date.UTC(2026, 10, 5, 12);

const found: SignInRow = {
  id: "u1",
  role: "member",
  disabled: 0,
  email_verified_at: NOW - 1000,
  secret: "$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA",
  pepper_id: 1,
};

describe("findForSignIn", () => {
  it("binds the email it is given", async () => {
    const { db, prepared } = fakeD1({ rows: [] });

    await credentialStore(db).findForSignIn("ada@example.com");

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.bound).toEqual(["ada@example.com"]);
  });

  it("reads the row back as the user and their credential", async () => {
    const { db } = fakeD1({ rows: [found] });

    expect(await credentialStore(db).findForSignIn("ada@example.com")).toEqual({
      ok: true,
      value: {
        user: { id: "u1", role: "member", disabled: false, emailVerifiedAt: NOW - 1000 },
        credential: { secret: found.secret, pepperId: 1 },
      },
    });
  });

  it("reports a disabled user as disabled", async () => {
    const { db } = fakeD1({ rows: [{ ...found, disabled: 1 }] });

    const result = await credentialStore(db).findForSignIn("ada@example.com");

    expect(result.ok && result.value?.user.disabled).toBe(true);
  });

  it("reports null when no user with a password has the email", async () => {
    const { db } = fakeD1({ rows: [] });

    expect(await credentialStore(db).findForSignIn("ada@example.com")).toEqual({ ok: true, value: null });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    expect(await credentialStore(db).findForSignIn("ada@example.com")).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "select credential for sign-in: D1_ERROR: Network connection lost." },
    });
  });
});

describe("setCredential", () => {
  it("binds the user, the kind, the PHC string, its pepper and now", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    const result = await credentialStore(db).setCredential({
      userId: "u1",
      kind: "password",
      secret: found.secret,
      pepperId: 1,
      now: NOW,
    });

    expect(prepared[0]?.bound).toEqual(["u1", "password", found.secret, 1, NOW]);
    expect(result).toEqual({ ok: true, value: undefined });
  });
});
