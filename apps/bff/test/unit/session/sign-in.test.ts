import { describe, expect, it } from "vitest";
import { WRONG } from "../../../src/lib/sign-in.ts";
import { fieldMessage } from "../../../src/lib/server/session/messages.ts";
import { signIn } from "../../../src/lib/server/session/sign-in.ts";

type Set = { name: string; value: string; options: unknown };

/** A cookie jar that records each cookie set. */
const jar = () => {
  const set: Set[] = [];
  const cookies = {
    set: (name: string, value: string, options?: unknown) => {
      set.push({ name, value, options });
    },
  };
  return { cookies, set };
};

const cookie = { name: "sid", secure: false };

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
};

/** A fake binding that answers once, and records what it was asked. */
const binding = (status: number, body: unknown) => {
  const asked: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    asked.push({ url, init });
    return Response.json(body, { status });
  };
  return { api: { fetch } as Pick<Fetcher, "fetch">, asked };
};

/** A fake binding for the cases that must not reach the api. */
const unreached = {
  fetch: () => {
    throw new Error("the api was reached");
  },
} as unknown as Pick<Fetcher, "fetch">;

const refused = (kind: string, status: number) => binding(status, { ok: false, error: { kind, message: "for developers" } });

const EXPIRES = Date.UTC(2026, 11, 6);

describe("signIn", () => {
  it("posts the email as the rules make it and the password as typed, and keeps the token as the session cookie until the absolute expiry", async () => {
    const { api, asked } = binding(201, { ok: true, data: { token: "raw-token", expiresAt: EXPIRES } });
    const { cookies, set } = jar();

    const result = await signIn(api, form({ email: "  Member@Example.TEST ", password: " pass word " }), cookies, cookie);

    expect(result).toEqual({ signedIn: true });
    expect(asked).toHaveLength(1);
    expect(asked[0]?.url).toBe("https://todo-api/sessions");
    expect(asked[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(asked[0]?.init?.body))).toEqual({ email: "member@example.test", password: " pass word " });
    expect(set).toEqual([
      {
        name: "sid",
        value: "raw-token",
        options: { path: "/", httpOnly: true, secure: false, sameSite: "lax", expires: new Date(EXPIRES) },
      },
    ]);
  });

  it("sets the cookie Secure under the name it is given", async () => {
    const { api } = binding(201, { ok: true, data: { token: "raw-token", expiresAt: EXPIRES } });
    const { cookies, set } = jar();

    await signIn(api, form({ email: "member@example.test", password: "p" }), cookies, { name: "__Host-sid", secure: true });

    expect(set[0]).toMatchObject({ name: "__Host-sid", options: { secure: true } });
  });

  it("answers 401 with wrong, keeping the email and never the password, when the api refuses the credentials", async () => {
    const { api } = refused("invalid_credentials", 401);
    const { cookies, set } = jar();

    const result = await signIn(api, form({ email: "member@example.test", password: "not it" }), cookies, cookie);

    expect(result).toEqual({ status: 401, data: { email: "member@example.test", wrong: true, fields: {} } });
    expect(JSON.stringify(result)).not.toContain("not it");
    expect(set).toEqual([]);
  });

  // Not the board's "maya@example": the WHATWG address L47 adopts allows a
  // domain with no dot, so `email.shape` holds for it.
  it("says what is wrong with each field, without asking the api", async () => {
    const { cookies, set } = jar();

    const result = await signIn(unreached, form({ email: "maya.example", password: "" }), cookies, cookie);

    expect(result).toEqual({
      status: 422,
      data: {
        email: "maya.example",
        wrong: false,
        fields: { email: "Enter a valid email address", password: "Password is required" },
      },
    });
    expect(set).toEqual([]);
  });

  it("says only the field that is wrong", async () => {
    const result = await signIn(unreached, form({ email: "", password: "p" }), jar().cookies, cookie);

    expect(result).toMatchObject({ status: 422, data: { email: "", fields: { email: "Email is required" } } });
    expect(result).not.toHaveProperty("data.fields.password");
  });

  it("treats a form with no fields as two empty fields' problems, without asking the api", async () => {
    const result = await signIn(unreached, new FormData(), jar().cookies, cookie);

    expect(result).toMatchObject({ status: 422, data: { email: "", wrong: false } });
  });

  // `sign-in.md`, Refused: every refusal but the credentials is
  // `accounts.error.failed`, which `handleError` draws for a throw.
  it.each([
    ["internal", 500],
    ["validation", 422],
    ["forbidden", 403],
    ["unauthenticated", 401],
    ["too_large", 413],
  ])("throws, for accounts.error.failed, when the api answers %s", async (kind, status) => {
    const { api } = refused(kind, status);
    const { cookies, set } = jar();

    await expect(signIn(api, form({ email: "member@example.test", password: "p" }), cookies, cookie)).rejects.toThrow("sign-in failed");
    expect(set).toEqual([]);
  });

  it("throws when the api cannot be read", async () => {
    const { api } = binding(200, "not an envelope");

    await expect(signIn(api, form({ email: "member@example.test", password: "p" }), jar().cookies, cookie)).rejects.toThrow();
  });
});

describe("fieldMessage", () => {
  it.each([
    [{ field: "email", rule: "email.length", violation: "empty", max: 254 }, "Email is required"],
    [{ field: "email", rule: "email.length", violation: "too_long", max: 254 }, "Email must be at most 254 characters"],
    [{ field: "email", rule: "email.shape", violation: "malformed" }, "Enter a valid email address"],
    [{ field: "password", rule: "password.given", violation: "empty", max: 128 }, "Password is required"],
    [{ field: "password", rule: "password.given", violation: "too_long", max: 128 }, "Password must be at most 128 characters"],
    [{ field: "email", rule: "not_text" }, "Something went wrong. Try again."],
  ] as const)("words %o", (problem, words) => {
    expect(fieldMessage(problem)).toBe(words);
  });

  it("words the max the problem carries, not a constant", () => {
    expect(fieldMessage({ field: "password", rule: "password.given", violation: "too_long", max: 7 })).toBe(
      "Password must be at most 7 characters",
    );
  });
});

describe("the page's words", () => {
  it("says wrong the same way for any account, with the board's words", () => {
    expect(WRONG).toBe("That email and password don’t match an account. Check both and try again.");
  });
});
