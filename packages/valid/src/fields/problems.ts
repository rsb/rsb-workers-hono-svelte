/**
 * Every problem of a candidate, once a field has failed: that field's
 * problem, then the problems of the fields after it, in field order
 * (`prd/todo/rules.md` › Every input). Private to `valid`, like `decode.ts`:
 * the generated validators call it.
 */

import type { Result } from "@todo/business/result.ts";
import type { Problem, Problems } from "../problem.ts";

/** A field's outcome; undefined for an optional field that was not given. */
type Outcome = Result<unknown, Problem> | undefined;

export const problemsFrom = (first: Problem, later: readonly Outcome[]): Problems => {
  const rest = later.flatMap((outcome) => (outcome === undefined || outcome.ok ? [] : [outcome.error]));
  return [first, ...rest];
};
