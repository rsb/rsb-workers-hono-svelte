import type { Rehash } from "@todo/business/auth/credential.ts";
import type { NewSession } from "@todo/business/auth/session.ts";
import { describe, expect, it } from "vitest";
import { signInStore } from "../../../src/identity/sign-in.ts";
import { fakeD1 } from "../fake-d1.ts";

const NOW = Date.UTC(2026, 10, 5, 12);

const session: NewSession = {
  id: "s-new",
  tokenHash: "hash-1",
  userId: "u1",
  channel: "cookie",
  createdAt: NOW,
  idleUntil: NOW + 1000,
  expiresAt: NOW + 2000,
  label: "Firefox on Linux",
  city: "Lisbon",
};

const rehash: Rehash = { userId: "u1", secret: "$argon2id$new", pepperId: 1, previousSecret: "$argon2id$old" };

describe("recordSignIn", () => {
  it("binds the session in column order, label and city last", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await signInStore(db).recordSignIn({ session });

    expect(prepared[0]?.bound).toEqual(["s-new", "hash-1", "u1", "cookie", NOW, NOW + 1000, NOW + 2000, "Firefox on Linux", "Lisbon"]);
  });

  it("stores a bearer session as it is given, with no idle window", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await signInStore(db).recordSignIn({ session: { ...session, channel: "bearer", idleUntil: null, label: null, city: null } });

    expect(prepared[0]?.bound).toEqual(["s-new", "hash-1", "u1", "bearer", NOW, null, NOW + 2000, null, null]);
  });

  it("is the insert alone without a presented session or a rehash", async () => {
    const { db, prepared, batches } = fakeD1({ changes: 1 });

    expect(await signInStore(db).recordSignIn({ session })).toEqual({ ok: true, value: { started: true } });
    expect(prepared).toHaveLength(1);
    expect(batches).toEqual([1]);
  });

  it("reports a taken token hash as not started", async () => {
    const { db } = fakeD1({ changes: 0 });

    expect(await signInStore(db).recordSignIn({ session })).toEqual({ ok: true, value: { started: false } });
  });

  it("ends the presented session as rotated, at the session's start, in the same batch", async () => {
    const { db, prepared, batches } = fakeD1({ changes: 1 });

    expect(await signInStore(db).recordSignIn({ session, rotate: "s-old" })).toEqual({ ok: true, value: { started: true } });
    expect(prepared[1]?.bound).toEqual(["s-old", "rotated", NOW]);
    expect(batches).toEqual([2]);
  });

  it("rehashes compare-and-set on the old PHC string, last in the same batch", async () => {
    const { db, prepared, batches } = fakeD1({ changes: 1 });

    const result = await signInStore(db).recordSignIn({ session, rotate: "s-old", rehash });

    expect(result).toEqual({ ok: true, value: { started: true, rehashed: true } });
    expect(prepared[2]?.bound).toEqual(["u1", "$argon2id$new", 1, NOW, "$argon2id$old"]);
    expect(batches).toEqual([3]);
  });

  it("reports a rehash another write got to first as not rehashed", async () => {
    const { db } = fakeD1({ changes: 0 });

    expect(await signInStore(db).recordSignIn({ session, rehash })).toEqual({
      ok: true,
      value: { started: false, rehashed: false },
    });
  });

  it("passes a D1 failure up, named by the batch", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    expect(await signInStore(db).recordSignIn({ session, rotate: "s-old" })).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "sign in: D1_ERROR: Network connection lost." },
    });
  });
});
