import { describe, expect, it } from "vitest";
import { toSignIn } from "../../../src/auth/sign-in.ts";

const EMAIL_EMPTY = { field: "email", rule: "email.length", violation: "empty", max: 254 };
const MALFORMED = { field: "email", rule: "email.shape", violation: "malformed" };
const PASSWORD_EMPTY = { field: "password", rule: "password.given", violation: "empty", max: 128 };

describe("toSignIn", () => {
  it("applies the email's rules, then the password's, as its rules say", () => {
    expect(toSignIn.rules).toEqual(["email.length", "email.shape", "password.given"]);
  });

  it("trims the email, then lower-cases it", () => {
    expect(toSignIn({ email: "  Member@Example.TEST ", password: "pw" })).toEqual({
      ok: true,
      value: { email: "member@example.test", password: "pw" },
    });
  });

  it("never trims or lower-cases the password", () => {
    const password = "  Correct Horse  ";

    expect(toSignIn({ email: "a@b.test", password })).toEqual({ ok: true, value: { email: "a@b.test", password } });
  });

  it("refuses an email of only spaces as empty, before its shape", () => {
    expect(toSignIn({ email: "   ", password: "pw" })).toEqual({ ok: false, error: [EMAIL_EMPTY] });
  });

  it("refuses 255 characters as too long, with the max", () => {
    const email = `${"a".repeat(246)}@b.test`;
    const tooLong = { field: "email", rule: "email.length", violation: "too_long", max: 254 };

    expect(email).toHaveLength(253);
    expect(toSignIn({ email: `aa${email}`, password: "pw" })).toEqual({ ok: false, error: [tooLong] });
  });

  it.each([
    ["no @", "member.example.test"],
    ["two @", "a@b@example.test"],
    ["an empty local part", "@example.test"],
    ["a space inside", "mem ber@example.test"],
    ["a label that starts with a hyphen", "a@-example.test"],
    ["a label of 64 characters", `a@${"b".repeat(64)}.test`],
    ["a character outside ASCII", "josé@example.test"],
    ["an upper-case one that lower-cases outside ASCII", "JOSÉ@example.test"],
  ])("refuses an email with %s as malformed", (_, email) => {
    expect(toSignIn({ email, password: "pw" })).toEqual({ ok: false, error: [MALFORMED] });
  });

  it.each([
    ["a domain with no dot, as WHATWG allows", "member@localhost"],
    ["the special characters WHATWG lists", "a.b+c!#$%&'*/=?^_`{|}~-@example.test"],
    ["a label of 63 characters", `a@${"b".repeat(63)}.test`],
  ])("accepts an email with %s", (_, email) => {
    expect(toSignIn({ email, password: "pw" })).toMatchObject({ ok: true });
  });

  it("refuses an empty password", () => {
    expect(toSignIn({ email: "a@b.test", password: "" })).toEqual({ ok: false, error: [PASSWORD_EMPTY] });
  });

  it("accepts a password of one character: the minimum is a set-time rule (L47)", () => {
    expect(toSignIn({ email: "a@b.test", password: "x" })).toMatchObject({ ok: true });
  });

  it("accepts 128 characters and refuses 129, with the max", () => {
    const tooLong = { field: "password", rule: "password.given", violation: "too_long", max: 128 };

    expect(toSignIn({ email: "a@b.test", password: "x".repeat(128) })).toMatchObject({ ok: true });
    expect(toSignIn({ email: "a@b.test", password: "x".repeat(129) })).toEqual({ ok: false, error: [tooLong] });
  });

  it("gives both fields' problems, in field order", () => {
    expect(toSignIn({ email: "nope", password: "" })).toEqual({ ok: false, error: [MALFORMED, PASSWORD_EMPTY] });
  });

  it("refuses fields that are not text as not_text", () => {
    expect(toSignIn({ email: 7, password: undefined })).toEqual({
      ok: false,
      error: [
        { field: "email", rule: "not_text" },
        { field: "password", rule: "not_text" },
      ],
    });
  });
});
