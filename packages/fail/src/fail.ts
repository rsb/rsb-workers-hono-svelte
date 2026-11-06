/**
 * Every failure our code can name. The package that first meets an error
 * decides which kind it is; every package above it only wraps it, so the
 * kind travels up unchanged. How a kind is shown is not decided here.
 */
export type FailKind =
  | "invalid"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "limit"
  | "too_large"
  | "unavailable"
  | "server";

/**
 * A failure of one kind. `message` is for developers, never for the person
 * using the app: the BFF writes what they see, from the kind. For a failure
 * the caller caused (`invalid`, `unauthenticated`, `forbidden`, `not_found`,
 * `limit`, `too_large`) the root's
 * message goes in the API's reply, so the caller can tell what went wrong;
 * for a failure the server caused (`unavailable`, `server`) it goes only to
 * the log. `cause` points to what it wraps, as Go's `%w` does, so a log
 * shows the chain back to the root cause. `field` is set only by `invalid`,
 * `reason` only by `forbidden`.
 */
export class Fail<K extends FailKind = FailKind> extends Error {
  readonly kind: K;
  readonly field: string | undefined;
  readonly reason: string | undefined;

  constructor(
    kind: K,
    message: string,
    options: { field?: string | undefined; reason?: string | undefined; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "Fail";
    this.kind = kind;
    this.field = options.field;
    this.reason = options.reason;
  }
}

/** Any one failure. It is a union by kind, so checking `kind` narrows it. */
export type AnyFail = { [K in FailKind]: Fail<K> }[FailKind];

/** Input that breaks a rule. `field` names the input; `body` means all of it. */
export const invalid = (field: string, message: string) => {
  return new Fail("invalid", message, { field });
};

/** The request's credential proves no one: who the caller is is unknown (L39). */
export const unauthenticated = (message: string, cause?: unknown) => {
  return new Fail("unauthenticated", message, { cause });
};

/**
 * The caller is known, or the request's channel is, and is refused anyway.
 * `reason` says why, in a word the caller can branch on. The words are
 * api.md's closed list, the contract's `Reason`; this package imports
 * nothing, so the api checks the word when it answers.
 */
export const forbidden = (reason: string, message: string, cause?: unknown) => {
  return new Fail("forbidden", message, { reason, cause });
};

/** The thing asked for does not exist. */
export const notFound = (message: string, cause?: unknown) => {
  return new Fail("not_found", message, { cause });
};

/** A business limit refused the request. */
export const limitReached = (message: string, cause?: unknown) => {
  return new Fail("limit", message, { cause });
};

/** The request is bigger than we accept. */
export const tooLarge = (message: string, cause?: unknown) => {
  return new Fail("too_large", message, { cause });
};

/** Something we depend on cannot answer now; trying again later may work. */
export const unavailable = (message: string, cause?: unknown) => {
  return new Fail("unavailable", message, { cause });
};

/** Our own fault, or an error nobody recognised. Trying again will not help. */
export const serverFault = (message: string, cause?: unknown) => {
  return new Fail("server", message, { cause });
};

/**
 * Adds context on the way up: the message becomes `context: inner message`.
 * The kind, field and reason never change once the root has set them.
 */
export const wrap = <F extends AnyFail>(inner: F, context: string): F => {
  const message = `${context}: ${inner.message}`;
  const outer = new Fail(inner.kind, message, { field: inner.field, reason: inner.reason, cause: inner });
  // The same kind, field and reason as `inner`, so it is the same type as `inner`.
  return outer as F;
};

/**
 * The failure that was first named: the bottom of the chain, following
 * causes only while they keep the kind of `fail`.
 */
export const rootOf = <F extends AnyFail>(fail: F): F => {
  let current: Fail = fail;
  while (current.cause instanceof Fail) {
    // A cause of another kind is not the same failure: a user's failure can
    // rest on a server's, and the server's message must not reach the user.
    const sameKind = current.cause.kind === fail.kind;
    if (!sameKind) {
      break;
    }
    current = current.cause;
  }
  // Every failure the loop passed through has the kind of `fail`.
  return current as F;
};

/**
 * What `fail` wraps, one line per link, from the nearest cause down: a
 * failure as `kind: message`, an error by its stack (its name and message
 * when it has none), anything else as text. The log writes it beside the
 * failure's own message; the reply never carries it.
 */
export const chainOf = (fail: Fail): string[] => {
  const chain: string[] = [];
  let cause: unknown = fail.cause;
  while (cause !== undefined) {
    if (cause instanceof Fail) {
      chain.push(`${cause.kind}: ${cause.message}`);
    } else if (cause instanceof Error) {
      chain.push(cause.stack ?? `${cause.name}: ${cause.message}`);
    } else {
      chain.push(String(cause));
    }
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return chain;
};
