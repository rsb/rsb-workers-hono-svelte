import type { AccessRow } from "@todo/business/access.ts";
import { verdict } from "@todo/operations/run.ts";
import type { Context, Handler } from "hono";
import { mapFailure } from "./app/handlers/present.ts";
import type { Route, Validator } from "./http.ts";

// The route helpers construct writes its table with (L19, L20, L33). They
// are generic over the operations a delivery runs, so construct binds them
// to its own `Operations` and their rows in `access.md`, and the type test
// binds them to others.

/** The one entry of `{ name: value }`, so that a name is read from its identifier. */
const named = <T>(single: Record<string, T>, what: string): [string, T] => {
  const entries = Object.entries(single);
  const [entry] = entries;
  if (entries.length !== 1 || entry === undefined) {
    throw new Error(`construct: ${what} must be one name, given ${entries.length}`);
  }
  return entry;
};

/** `true` when `A` and `B` are the same type, not only assignable one way. */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** The operations of `O` whose type is exactly `U`. */
type UnitsTyped<O, U> = {
  [P in keyof O]: Same<O[P], U> extends true ? P : never;
}[keyof O];

/**
 * Nothing when a handler that takes `U` may run the unit `K` of `O`;
 * otherwise a property no argument has, so the call does not compile. The
 * handler must take exactly the unit's type, and no other operation may
 * have that type: a unit that takes fewer arguments than the handler's, or
 * none, or several units, do not compile.
 */
type Runs<O, K extends keyof O, U> = Same<UnitsTyped<O, U>, K> extends true
  ? unknown
  : { "the handler does not take exactly this unit's type, or another operation has the same type": K };

/** What a handler is given and gives: its unit, then its validator if it takes one. */
type Builds = (unit: never, validator: never) => Route["handler"];

/**
 * The handler, behind its unit's row: the runner's own verdict on the actor
 * the gates attached, answered before the handler reads the request. So a
 * caller the row refuses is told 401 or 403, never 400 or 422 about input
 * it may not send (`api.md` › Every endpoint). This is a presentation
 * choice: the unit still checks its row when it runs, and stays the
 * authority (L43).
 */
const behind = (name: string, row: AccessRow, handler: Handler): Handler => {
  const mirrored: Handler = (c, next) => {
    const given = verdict(name, row, c.get("actor"));
    if (!given.ok) {
      return mapFailure(c, given.error);
    }
    return handler(c, next);
  };
  return mirrored;
};

/**
 * `route` and `probe` for the operations `O`, each with its row:
 * `const { route, probe } = routing<Operations>(access);`.
 */
export const routing = <O>(rows: { readonly [K in keyof O]: AccessRow }) => {
  /**
   * A route whose handler runs one unit (L19), and builds its input with one
   * validator when it takes one (L33). Each is given as `{ name }`, so the
   * route carries their names as data and the handler is built here:
   * `route({ postTodos }, { addTodo }, { toNewTodo })` is
   * `postTodos(addTodo, toNewTodo)`, named `postTodos`, running `addTodo` and
   * applying what `toNewTodo` applies. The unit must be one of `O`, and the
   * handler must take exactly its type (`Runs`). The validator is the one
   * the handler is given, so what the route says it applies is what runs: a
   * handler that takes a validator is not built without one, and one that
   * takes none is not given one. That the names are the values' own is
   * checked by `pnpm check:entry-chains`, which reads construct. The
   * handler runs behind its unit's row (`behind`).
   */
  function route<K extends keyof O, U>(
    handler: Record<string, (unit: U) => Route["handler"]>,
    unit: Pick<O, K> & Runs<O, K, U>,
  ): Route;
  function route<K extends keyof O, H extends Builds>(
    handler: Record<string, H>,
    unit: Pick<O, K> & Runs<O, K, Parameters<H>[0]>,
    validator: Record<string, Parameters<H>[1] & Validator>,
  ): Route;
  function route(handler: Record<string, Builds>, unit: Record<string, unknown>, validator?: Record<string, Validator>): Route {
    const [name, build] = named(handler, "a route's handler");
    const [unitName, built] = named(unit, "a route's unit");
    // The unit is one of `O`, so it has a row.
    const row = rows[unitName as keyof O];
    if (validator === undefined) {
      const handler = behind(unitName, row, build(built as never, undefined as never));
      return { name, unit: unitName, validator: null, handler };
    }
    const [validatorName, value] = named(validator, "a route's validator");
    return {
      name,
      unit: unitName,
      validator: { name: validatorName, value },
      handler: behind(unitName, row, build(built as never, value as never)),
    };
  }

  /** A probe's route: its entry point takes the request and runs no unit (L20). `probe({ getHealth })`. */
  const probe = (handler: Record<string, (c: Context) => Response | Promise<Response>>): Route => {
    const [name, built] = named(handler, "a probe");
    return { name, unit: null, validator: null, handler: built };
  };

  return { route, probe };
};
