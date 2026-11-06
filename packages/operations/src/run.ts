import { type AccessRow, type OperationName, type Requires, access } from "@todo/business/access.ts";
import type { Actor } from "@todo/business/auth/actor.ts";
import type { Any, Own } from "@todo/business/auth/scope.ts";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type AnyFail, forbidden, unauthenticated } from "@todo/fail/fail.ts";

// The shared runner (L39, L43). Every operation's builder returns its body
// wrapped in `run`, so a built operation carries its own check and no
// delivery applies one: what may run, and with which scope, is decided
// once, from the operation's row in `access.md`.

/**
 * What a body is handed for its row's `Scope`: the actor's own rows, every
 * row, or, for `n/a`, the actor itself: such an operation touches no owned
 * row, so there is no scope to work out.
 */
export type ScopeOf<N extends OperationName> = {
  own: Own;
  any: Any;
  "n/a": Actor;
}[(typeof access)[N]["scope"]];

/** Whether an actor is at least what a row requires. */
const meets = (actor: Actor, requires: Requires): boolean => {
  if (requires === "anonymous") {
    return true;
  }
  if (actor.kind === "anonymous") {
    return false;
  }
  switch (requires) {
    case "member":
      return true;
    case "verified_member":
      return actor.emailVerified;
    case "admin":
      return actor.role === "admin";
  }
};

/**
 * The runner's verdict on one actor for one row: what the body is handed,
 * or the refusal. An actor below `requires` is refused before the body:
 * anonymous as `unauthenticated`, a signed-in one as `forbidden` with the
 * reason `role` (`access.md` › Columns).
 */
export const verdict = (name: string, row: AccessRow, actor: Actor): Result<Own | Any | Actor, AnyFail> => {
  if (!meets(actor, row.requires)) {
    if (actor.kind === "anonymous") {
      return err(unauthenticated(`${name} requires a signed-in user`));
    }
    return err(forbidden("role", `${name} requires ${row.requires}`));
  }
  if (row.scope === "n/a") {
    return ok(actor);
  }
  // `access.md` gives `own` and `any` only to rows that require a signed-in
  // user (`check:access`), so the actor is one here.
  if (actor.kind === "anonymous") {
    return err(unauthenticated(`${name} requires a signed-in user`));
  }
  if (row.scope === "any") {
    return ok({ any: true });
  }
  return ok({ ownerId: actor.userId });
};

/** Which operation each built function runs as, for the dynamic access test. */
const ran = new WeakMap<object, OperationName>();

/** The name a built operation was wrapped under, or undefined for a function `run` did not build. */
export const operationOf = (built: object): OperationName | undefined => ran.get(built);

/**
 * Wraps an operation's body in its row: the built operation takes the
 * actor, then the body's own arguments, and runs the body only when the
 * verdict lets it, handing it the scope and never the actor (`n/a` aside).
 * A name without a row does not compile, and the scope's type is the row's.
 */
export const run = <N extends OperationName, A extends unknown[], R>(
  name: N,
  body: (scope: ScopeOf<N>, ...args: A) => Promise<Result<R, AnyFail>>,
): ((actor: Actor, ...args: A) => Promise<Result<R, AnyFail>>) => {
  const row: AccessRow = access[name];
  const built = async (actor: Actor, ...args: A): Promise<Result<R, AnyFail>> => {
    const given = verdict(name, row, actor);
    if (!given.ok) {
      return err(given.error);
    }
    // The verdict follows the row's scope, so it is `ScopeOf<N>`.
    return body(given.value as ScopeOf<N>, ...args);
  };
  ran.set(built, name);
  return built;
};
