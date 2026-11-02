import type { ErrorKind, Failure } from "@todo/contract-api";
import { type AnyFail, type Fail, type FailKind, rootOf } from "@todo/fail/fail.ts";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const status = {
  validation: 422,
  not_found: 404,
  limit: 409,
  too_large: 413,
  internal: 500,
} as const satisfies Record<ErrorKind, ContentfulStatusCode>;

/**
 * The map: each failure kind as the contract names it. Every kind must have
 * an entry, so a new kind does not compile until it is given one.
 * `unavailable` is `internal` until the contract has a kind for it.
 */
const contractKind = {
  invalid: "validation",
  not_found: "not_found",
  limit: "limit",
  too_large: "too_large",
  unavailable: "internal",
  server: "internal",
} as const satisfies Record<FailKind, ErrorKind>;

/** The failures the caller caused: the 4xx statuses. */
type UserFail = Fail<"invalid" | "not_found" | "limit" | "too_large">;

/** The failures the server caused: the 5xx statuses. */
type ServerFail = Fail<"unavailable" | "server">;

/** The success envelope, for a request that was answered. */
export const success = <T>(c: Context, data: T) => {
  return c.json({ ok: true, data }, 200);
};

/** The success envelope, for a request that created something. */
export const created = <T>(c: Context, data: T) => {
  return c.json({ ok: true, data }, 201);
};

/**
 * The error envelope, for a request the caller got wrong. The message is
 * the root failure's: what was first named, without the chain above it.
 */
export const userFailure = (c: Context, fail: UserFail) => {
  const kind = contractKind[fail.kind];
  const message = rootOf(fail).message;

  if (kind === "validation") {
    // An invalid failure always names its field; `body` stands for all of it.
    const field = fail.field ?? "body";
    const reply = { ok: false, error: { kind, message, field } } satisfies Failure;
    return c.json(reply, status[kind]);
  }

  const reply = { ok: false, error: { kind, message } } satisfies Failure;
  return c.json(reply, status[kind]);
};

/**
 * The error envelope, for a request the server could not answer. The whole
 * chain goes to the log; the reply says only `internal error` (PRD, Envelope).
 */
export const serverFailure = (c: Context, fail: ServerFail) => {
  console.error(fail);

  const kind = contractKind[fail.kind];
  const reply = { ok: false, error: { kind, message: "internal error" } } satisfies Failure;
  return c.json(reply, status[kind]);
};

/**
 * Resolves a failure whose kind the handler cannot know, such as one an
 * operation returns, to the user's side or the server's. The switch names
 * every kind, so a new kind does not compile until it is given a side.
 */
export const mapFailure = (c: Context, fail: AnyFail) => {
  switch (fail.kind) {
    case "invalid":
    case "not_found":
    case "limit":
    case "too_large": {
      return userFailure(c, fail);
    }
    case "unavailable":
    case "server": {
      return serverFailure(c, fail);
    }
    default: {
      const unmapped: never = fail;
      throw new Error(`unmapped failure: ${String(unmapped)}`);
    }
  }
};
