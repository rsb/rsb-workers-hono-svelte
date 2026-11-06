// Configuration is data the api reads at startup: plain values that vary by
// deployment, like limits, URLs and flags. Bindings such as D1 are not
// configuration: the platform hands them over already configured and built,
// so they go straight to `constructInfra`. Each value is a `vars` entry in
// `wrangler.jsonc`; local dev overrides one in `.dev.vars`.
//
// `readConfig` is the schema: the api reads its config through it, and so
// does tooling/config-check, which checks a deploy's variables before they
// run. So it imports only `Result`, from business, which imports nothing: a
// node script runs it as it is.

import { type Result, err, ok } from "@todo/business/result.ts";

/** The api's configuration, as construct takes it. */
export type Config = {
  /** The BFF's origin, which the `channel` gate compares `Origin` with (L38). */
  bffOrigin: string;
  /**
   * The session cookie's name: `__Host-sid`, or `sid` under
   * `http://localhost`, where a browser refuses a `__Host-` cookie (PRD,
   * Security). It is one value; no code branches on the environment.
   */
  sessionCookie: string;
};

/** Each variable the config is read from. */
export const CONFIG_VARS = ["BFF_ORIGIN", "SESSION_COOKIE"] as const;
export type ConfigVar = (typeof CONFIG_VARS)[number];

/** One thing wrong with the variables: which one, and what. */
export type ConfigProblem = { name: ConfigVar; problem: string };

/** The hosts a browser treats as secure over plain http: local dev's. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** A cookie name is an RFC 6265 token: no controls, spaces or separators. */
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/** The prefixes a browser accepts only from a secure origin. */
const SECURE_PREFIX = /^__(Host|Secure)-/i;

/** `BFF_ORIGIN`'s problem, or null: an origin and nothing more, https unless local. */
const originProblem = (value: string): string | null => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `is ${JSON.stringify(value)}, which is not a URL`;
  }
  if (url.origin !== value) {
    // A path, query, fragment, trailing slash or capital letter: the
    // `channel` gate compares `Origin` as a browser sends it, exactly.
    return `is ${JSON.stringify(value)}, which is not an origin as a browser sends it: ${url.origin}`;
  }
  if (url.protocol === "https:") {
    return null;
  }
  if (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) {
    return null;
  }
  return `is ${JSON.stringify(value)}: an origin is https, or http only on localhost or 127.0.0.1`;
};

/** `SESSION_COOKIE`'s problem on its own, or null. */
const cookieProblem = (value: string): string | null =>
  COOKIE_NAME.test(value) ? null : `is ${JSON.stringify(value)}, which is not a cookie name`;

/**
 * The configuration, from the Worker's vars, or every problem with them,
 * each under its variable. A `__Host-` or `__Secure-` cookie needs an https
 * BFF: no browser accepts one over http, so the pair could not hold a
 * session. The rule runs one way: a plain name over https is allowed.
 */
export const readConfig = (vars: Readonly<Partial<Record<ConfigVar, unknown>>>): Result<Config, ConfigProblem[]> => {
  const problems: ConfigProblem[] = [];
  const read = (name: ConfigVar, check: (value: string) => string | null): string | null => {
    const value = vars[name];
    if (typeof value !== "string") {
      problems.push({ name, problem: value === undefined ? "is not set" : "is not a string" });
      return null;
    }
    const problem = check(value);
    if (problem !== null) {
      problems.push({ name, problem });
      return null;
    }
    return value;
  };

  const bffOrigin = read("BFF_ORIGIN", originProblem);
  const sessionCookie = read("SESSION_COOKIE", cookieProblem);
  if (bffOrigin !== null && sessionCookie !== null && SECURE_PREFIX.test(sessionCookie) && !bffOrigin.startsWith("https:")) {
    problems.push({
      name: "SESSION_COOKIE",
      problem: `is ${sessionCookie}, which a browser accepts only over https, and BFF_ORIGIN is ${bffOrigin}`,
    });
  }

  if (bffOrigin === null || sessionCookie === null || problems.length > 0) {
    return err(problems);
  }
  return ok({ bffOrigin, sessionCookie });
};

/** The problems, one per line, as the log and the checker print them. */
export const describeProblems = (problems: readonly ConfigProblem[]): string =>
  problems.map(({ name, problem }) => `${name} ${problem}`).join("\n");
