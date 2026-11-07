import { type ErrorKind, type Failure, KIND_STATUS, Reason } from "@todo/contract-api";
import { type AnyFail, type Fail, type FailKind, chainOf, rootOf, serverFault } from "@todo/fail/fail.ts";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as v from "valibot";
import { type Log, consoleLog } from "../../log.ts";

/** Each kind's status, from the spec through the contract. */
const status = KIND_STATUS satisfies Record<ErrorKind, ContentfulStatusCode>;

/**
 * The map: each failure kind as the contract names it. Every kind must have
 * an entry, so a new kind does not compile until it is given one.
 * `unavailable` is `internal` until the contract has a kind for it.
 */
const contractKind = {
  invalid: "validation",
  unauthenticated: "unauthenticated",
  invalid_credentials: "invalid_credentials",
  forbidden: "forbidden",
  not_found: "not_found",
  limit: "limit",
  too_large: "too_large",
  unavailable: "internal",
  server: "internal",
} as const satisfies Record<FailKind, ErrorKind>;

/** The failures the caller caused: the 4xx statuses. */
type UserFail = Fail<"invalid" | "unauthenticated" | "invalid_credentials" | "forbidden" | "not_found" | "limit" | "too_large">;

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

  if (kind === "forbidden") {
    // `fail` cannot import the contract, so its reason is a string. One the
    // contract does not list is our bug, not the caller's: it is logged.
    const reason = fail.reason;
    if (!v.is(Reason, reason)) {
      return serverFailure(c, serverFault(`forbidden gives the reason ${reason}, which api.md does not list`, fail));
    }
    const reply = { ok: false, error: { kind, message, reason } } satisfies Failure;
    return c.json(reply, status[kind]);
  }

  const reply = { ok: false, error: { kind, message } } satisfies Failure;
  return c.json(reply, status[kind]);
};

/**
 * The error envelope, for a request the server could not answer. The whole
 * chain goes to the log, as one line: `{ requestId, method, path, kind,
 * message, chain }`, through the log the `requestId` gate bound (L38). The
 * reply says only `internal error` (PRD, Envelope).
 */
export const serverFailure = (c: Context, fail: ServerFail) => {
  // Unset only when no gate ran, as in a handler's unit test.
  const log: Log | undefined = c.get("log");
  (log ?? consoleLog(null)).error({
    method: c.req.method,
    path: c.req.path,
    kind: fail.kind,
    message: fail.message,
    chain: chainOf(fail),
  });

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
    case "unauthenticated":
    case "invalid_credentials":
    case "forbidden":
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
