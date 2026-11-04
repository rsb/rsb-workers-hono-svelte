import { type Result, err, ok } from "@todo/business/result.ts";
import { flag } from "../fields/decode.ts";
import type { Problems } from "../problem.ts";

/**
 * What a delivery read for the `completed` every todo should take, not yet
 * decoded. The input has no named type: it is the boolean
 * `setAllCompleted` takes.
 */
export type CompletedCandidate = { completed: unknown };

/** The `completed` every todo should take: a boolean. */
export const toCompleted = (candidate: CompletedCandidate): Result<boolean, Problems> => {
  const decoded = flag("completed", candidate.completed);
  if (!decoded.ok) {
    return err([decoded.error]);
  }

  return ok(decoded.value);
};
