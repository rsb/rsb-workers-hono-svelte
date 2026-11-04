// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.
import type { Problem } from "../problem.ts";

/**
 * `patch.nonempty`: A patch gives a title, a `completed`, or both. Gives the
 * problem of the first violation, or undefined when the rule holds.
 */
export const patchNonempty = (candidate: { title?: unknown; completed?: unknown }): Problem | undefined => {
  const given = [candidate.title, candidate.completed].filter((value) => value !== undefined).length;
  if (given < 1) {
    return { rule: "patch.nonempty", violation: "empty" };
  }
  return undefined;
};
