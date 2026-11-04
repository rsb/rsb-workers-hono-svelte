/**
 * Decode: a field's value, `unknown`, narrowed to the type the field needs.
 * Private to `valid`: the package's `exports` map does not list `fields/`.
 *
 * Why candidates are `unknown`, when the api's contract has already checked
 * the types a line before (L27, Q2): `valid` is the one authority for every
 * delivery. A form, a command line or a queue message has no contract
 * schema, so the decode runs here, once, for all of them, and over HTTP it
 * runs twice. That costs microseconds and keeps each delivery to one line
 * that fills a candidate.
 *
 * A spelling a delivery needs (a checkbox's "on", say) is added here, never
 * in the delivery.
 */

import { type Result, err, ok } from "@todo/business/result.ts";
import type { Field, Problem } from "../problem.ts";

/** Text as it is, untrimmed. Anything else is `not_text`. */
export const text = (field: Field, value: unknown): Result<string, Problem> => {
  if (typeof value === "string") {
    return ok(value);
  }
  return err({ field, rule: "not_text" });
};

/**
 * A boolean, from `true` and `false` (JSON) or `"true"` and `"false"` (a
 * query string or a form). Anything else is `not_boolean`.
 */
export const flag = (field: Field, value: unknown): Result<boolean, Problem> => {
  if (value === true || value === "true") {
    return ok(true);
  }
  if (value === false || value === "false") {
    return ok(false);
  }
  return err({ field, rule: "not_boolean" });
};
