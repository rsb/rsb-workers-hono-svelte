/**
 * Every failure our code can name. The package that first meets an error
 * decides which kind it is; every package above it only wraps it, so the
 * kind travels up unchanged. How a kind is shown is not decided here.
 */
export type FailKind = "invalid" | "not_found" | "limit" | "too_large" | "unavailable" | "server";

/**
 * A failure of one kind. `message` is for developers, never for the person
 * using the app: the BFF writes what they see, from the kind. For a failure
 * the caller caused (`invalid`, `not_found`, `limit`, `too_large`) the root's
 * message goes in the API's reply, so the caller can tell what went wrong;
 * for a failure the server caused (`unavailable`, `server`) it goes only to
 * the log. `cause` points to what it wraps, as Go's `%w` does, so a log
 * shows the chain back to the root cause. `field` is set only by `invalid`.
 */
export class Fail<K extends FailKind = FailKind> extends Error {
  readonly kind: K;
  readonly field: string | undefined;

  constructor(kind: K, message: string, options: { field?: string | undefined; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "Fail";
    this.kind = kind;
    this.field = options.field;
  }
}

/** Any one failure. It is a union by kind, so checking `kind` narrows it. */
export type AnyFail = { [K in FailKind]: Fail<K> }[FailKind];

/** Input that breaks a rule. `field` names the input; `body` means all of it. */
export const invalid = (field: string, message: string) => {
  return new Fail("invalid", message, { field });
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
 * The kind and field never change once the root has set them.
 */
export const wrap = <F extends AnyFail>(inner: F, context: string): F => {
  const message = `${context}: ${inner.message}`;
  const outer = new Fail(inner.kind, message, { field: inner.field, cause: inner });
  // The same kind and field as `inner`, so it is the same type as `inner`.
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
