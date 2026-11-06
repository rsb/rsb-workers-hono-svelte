import { Failure } from "@todo/contract-api";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { describeProblems, readConfig } from "../../src/config.ts";
import { misconfigured } from "../../src/misconfigured.ts";
import { config } from "./test-api.ts";

/** A pepper of the length the dev seed writes. Not a secret: it keys nothing. */
const PEPPER = "p".repeat(43);
const DEPLOYED = { BFF_ORIGIN: "https://todo.example", SESSION_COOKIE: "__Host-sid", PEPPER_1: PEPPER };
const LOCAL = { BFF_ORIGIN: "http://localhost:5173", SESSION_COOKIE: "sid", PEPPER_1: PEPPER };

/** The problems `readConfig` gives, as `[name, problem]` pairs. */
const problems = (vars: Record<string, unknown>) => {
  const read = readConfig(vars);
  return read.ok ? [] : read.error.map(({ name, problem }) => [name, problem]);
};

describe("readConfig", () => {
  it("reads a deployed config", () => {
    expect(readConfig(DEPLOYED)).toEqual({ ok: true, value: { bffOrigin: "https://todo.example", sessionCookie: "__Host-sid", peppers: { 1: PEPPER } } });
  });

  it("reads local dev's config: http on localhost, and a plain cookie name", () => {
    expect(readConfig(LOCAL)).toEqual({ ok: true, value: { bffOrigin: "http://localhost:5173", sessionCookie: "sid", peppers: { 1: PEPPER } } });
    expect(readConfig({ ...LOCAL, BFF_ORIGIN: "http://127.0.0.1:5173" }).ok).toBe(true);
  });

  it("reads the unit tests' config: a plain name over https is allowed", () => {
    const vars = { BFF_ORIGIN: config.bffOrigin, SESSION_COOKIE: config.sessionCookie, PEPPER_1: config.peppers[1] };
    expect(readConfig(vars)).toEqual({ ok: true, value: config });
  });

  it("names every variable that is missing, or not a string", () => {
    expect(problems({})).toEqual([
      ["BFF_ORIGIN", "is not set"],
      ["SESSION_COOKIE", "is not set"],
      ["PEPPER_1", "is not set"],
    ]);
    expect(problems({ ...LOCAL, BFF_ORIGIN: 5173 })).toEqual([["BFF_ORIGIN", "is not a string"]]);
  });

  it("refuses a PEPPER_1 shorter than 32 characters, and never repeats it", () => {
    const short = "a-pepper-of-31-characters-xxxxx";
    expect(short).toHaveLength(31);
    expect(problems({ ...LOCAL, PEPPER_1: short })).toEqual([["PEPPER_1", "is 31 characters, and a pepper is at least 32"]]);
    expect(readConfig({ ...LOCAL, PEPPER_1: "x".repeat(32) }).ok).toBe(true);
  });

  it("refuses a BFF_ORIGIN that is not an origin exactly as a browser sends it", () => {
    for (const origin of ["todo.example", "https://todo.example/", "https://todo.example/app", "https://todo.example?x=1", "https://Todo.example"]) {
      expect(problems({ ...DEPLOYED, BFF_ORIGIN: origin }), origin).toHaveLength(1);
    }
    expect(problems({ ...DEPLOYED, BFF_ORIGIN: "https://todo.example/" })).toEqual([
      ["BFF_ORIGIN", 'is "https://todo.example/", which is not an origin as a browser sends it: https://todo.example'],
    ]);
  });

  it("refuses http anywhere but localhost", () => {
    expect(problems({ ...LOCAL, BFF_ORIGIN: "http://todo.example" })).toEqual([
      ["BFF_ORIGIN", 'is "http://todo.example": an origin is https, or http only on localhost or 127.0.0.1'],
    ]);
  });

  it("refuses a SESSION_COOKIE that is not a cookie name", () => {
    for (const name of ["", "s id", "sid;", "sid=1", "séd"]) {
      expect(problems({ ...LOCAL, SESSION_COOKIE: name }), name).toEqual([["SESSION_COOKIE", `is ${JSON.stringify(name)}, which is not a cookie name`]]);
    }
  });

  it("refuses a __Host- or __Secure- cookie with an http BFF: no browser accepts it", () => {
    for (const name of ["__Host-sid", "__Secure-sid", "__host-sid"]) {
      expect(problems({ ...LOCAL, SESSION_COOKIE: name }), name).toEqual([
        ["SESSION_COOKIE", `is ${name}, which a browser accepts only over https, and BFF_ORIGIN is http://localhost:5173`],
      ]);
    }
  });

  it("names every problem at once, one line each", () => {
    const read = readConfig({ BFF_ORIGIN: "http://todo.example", SESSION_COOKIE: "s id", PEPPER_1: PEPPER });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(describeProblems(read.error)).toBe(
        'BFF_ORIGIN is "http://todo.example": an origin is https, or http only on localhost or 127.0.0.1\nSESSION_COOKIE is "s id", which is not a cookie name',
      );
    }
  });
});

describe("the api, when its config does not read", () => {
  const read = readConfig({ BFF_ORIGIN: "http://todo.example" });
  if (read.ok) {
    throw new Error("expected the config not to read");
  }

  it("answers every request internal, in the envelope, and never says why", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const api = misconfigured(read.error);
    for (const request of [new Request("https://api/health"), new Request("https://api/todos", { method: "POST", body: "{}" })]) {
      const response = api.fetch(request);
      expect(response.status).toBe(500);
      expect(v.parse(Failure, await response.json())).toEqual({ ok: false, error: { kind: "internal", message: "internal error" } });
    }
  });

  it("logs the problems once, on the first request, as one line", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const api = misconfigured(read.error);
    api.fetch(new Request("https://api/health"));
    api.fetch(new Request("https://api/health"));
    expect(logged).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(logged.mock.calls[0]?.[0]))).toEqual({
      requestId: null,
      kind: "config",
      message: describeProblems(read.error),
      problems: [
        { name: "BFF_ORIGIN", problem: 'is "http://todo.example": an origin is https, or http only on localhost or 127.0.0.1' },
        { name: "SESSION_COOKIE", problem: "is not set" },
        { name: "PEPPER_1", problem: "is not set" },
      ],
    });
  });
});
