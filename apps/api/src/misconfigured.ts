import { type Failure, KIND_STATUS } from "@todo/contract-api";
import { type ConfigProblem, describeProblems } from "./config.ts";
import { consoleLog } from "./log.ts";

/**
 * The api when its config did not read: nothing is built, and every request
 * is answered `internal` in the envelope, so the BFF reads a reply it knows.
 * The reply says only `internal error`, as every `internal` does: the cause
 * is logged, never sent (PRD, Envelope). The problems are logged once, on
 * the first request, where the Worker's log has a request to put them
 * under. `unavailable` (503) replaces `internal` here when the contract has
 * that kind (backlog E).
 */
export const misconfigured = (problems: readonly ConfigProblem[]) => {
  let logged = false;
  return {
    fetch: (_request: Request): Response => {
      if (!logged) {
        logged = true;
        consoleLog(null).error({ kind: "config", message: describeProblems(problems), problems });
      }
      const reply = { ok: false, error: { kind: "internal", message: "internal error" } } satisfies Failure;
      return Response.json(reply, { status: KIND_STATUS.internal });
    },
  };
};
