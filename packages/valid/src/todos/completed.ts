// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.
import { type Result, err, ok } from "@todo/business/result.ts";
import type { RuleId } from "@todo/business/rules.ts";
import { flag } from "../fields/decode.ts";
import type { Problems } from "../problem.ts";

/** What a delivery read for a `Completed`, not yet decoded. */
export type CompletedCandidate = { completed: unknown };

/**
 * A `Completed` from what a delivery read. The `completed` every todo should
 * take. Gives every problem it finds, as prd/todo/rules.md › Every input says.
 */
export const toCompleted = (candidate: CompletedCandidate): Result<boolean, Problems> => {
  const completed = flag("completed", candidate.completed);

  if (!completed.ok) {
    return err([completed.error]);
  }

  return ok(completed.value);
};

/** The rules `toCompleted` applies, by id: what a route that runs it applies (L33). */
toCompleted.rules = [] as const satisfies readonly RuleId[];
