import { describe, expect, it } from "vitest";
import { type UserRow, userStore } from "../../../src/identity/users.ts";
import { fakeD1 } from "../fake-d1.ts";

const NOW = Date.UTC(2026, 10, 5, 12);

describe("createUser", () => {
  const user = { id: "u1", email: "ada@example.com", name: "Ada Lovelace", role: "member" as const, createdAt: NOW };

  it("binds the user in column order", async () => {
    const { db, prepared } = fakeD1({ changes: 1 });

    await userStore(db).createUser(user);

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.bound).toEqual(["u1", "ada@example.com", "Ada Lovelace", "member", NOW]);
  });

  it.each([
    [1, true],
    [0, false],
  ])("reports %i changed rows as created: %s", async (changes, created) => {
    const { db } = fakeD1({ changes });

    expect(await userStore(db).createUser(user)).toEqual({ ok: true, value: created });
  });

  it("passes a D1 failure up, named by the statement", async () => {
    const { db } = fakeD1({ throws: new Error("D1_ERROR: Network connection lost.") });

    expect(await userStore(db).createUser(user)).toMatchObject({
      ok: false,
      error: { kind: "unavailable", message: "insert user: D1_ERROR: Network connection lost." },
    });
  });
});

describe("findUserByEmail", () => {
  const row: UserRow = {
    id: "u1",
    email: "ada@example.com",
    name: "Ada Lovelace",
    role: "admin",
    disabled: 1,
    email_verified_at: NOW - 1000,
    created_at: NOW - 2000,
  };

  it("binds the email it is given", async () => {
    const { db, prepared } = fakeD1({ rows: [] });

    await userStore(db).findUserByEmail("ada@example.com");

    expect(prepared[0]?.bound).toEqual(["ada@example.com"]);
  });

  it("reads the row back as the user", async () => {
    const { db } = fakeD1({ rows: [row] });

    expect(await userStore(db).findUserByEmail("ada@example.com")).toEqual({
      ok: true,
      value: {
        id: "u1",
        email: "ada@example.com",
        name: "Ada Lovelace",
        role: "admin",
        disabled: true,
        emailVerifiedAt: NOW - 1000,
        createdAt: NOW - 2000,
      },
    });
  });

  it("reports null when no user has the email", async () => {
    const { db } = fakeD1({ rows: [] });

    expect(await userStore(db).findUserByEmail("ada@example.com")).toEqual({ ok: true, value: null });
  });
});
