// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.
import { TITLE_MAX } from "@todo/business/rules.ts";
import type { Problem } from "../problem.ts";

/**
 * `title.length`: A title is 1 to `max` long, counted in UTF-16 code units.
 * Gives the problem of the first violation, or undefined when the rule holds.
 */
export const titleLength = (field: "title", value: string): Problem | undefined => {
  if (value.length < 1) {
    return { field, rule: "title.length", violation: "empty", max: TITLE_MAX };
  }
  if (value.length > TITLE_MAX) {
    return { field, rule: "title.length", violation: "too_long", max: TITLE_MAX };
  }
  return undefined;
};
