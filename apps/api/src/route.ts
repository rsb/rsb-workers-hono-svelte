import type { Context } from "hono";
import type { Route, Validator } from "./http.ts";

// The route helpers construct writes its table with (L19, L20, L33). They
// are generic over the operations a delivery runs, so construct binds them
// to its own `Operations`, and the type test binds them to others.

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
 * `route` and `probe` for the operations `O`:
 * `const { route, probe } = routing<Operations>();`.
 */
export const routing = <O>() => {
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
   * checked by `pnpm check:entry-chains`, which reads construct.
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
    if (validator === undefined) {
      return { name, unit: unitName, validator: null, handler: build(built as never, undefined as never) };
    }
    const [validatorName, value] = named(validator, "a route's validator");
    return {
      name,
      unit: unitName,
      validator: { name: validatorName, value },
      handler: build(built as never, value as never),
    };
  }

  /** A probe's route: its entry point takes the request and runs no unit (L20). `probe({ getHealth })`. */
  const probe = (handler: Record<string, (c: Context) => Response | Promise<Response>>): Route => {
    const [name, built] = named(handler, "a probe");
    return { name, unit: null, validator: null, handler: built };
  };

  return { route, probe };
};
