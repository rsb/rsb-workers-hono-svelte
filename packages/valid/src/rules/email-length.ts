// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.
import { EMAIL_MAX } from "@todo/business/rules.ts";
import type { Problem } from "../problem.ts";

/**
 * `email.length`: An email is 1 to `max` long, counted in UTF-16 code units.
 * Gives the problem of the first violation, or undefined when the rule holds.
 */
export const emailLength = (field: "email", value: string): Problem | undefined => {
  if (value.length < 1) {
    return { field, rule: "email.length", violation: "empty", max: EMAIL_MAX };
  }
  if (value.length > EMAIL_MAX) {
    return { field, rule: "email.length", violation: "too_long", max: EMAIL_MAX };
  }
  return undefined;
};
