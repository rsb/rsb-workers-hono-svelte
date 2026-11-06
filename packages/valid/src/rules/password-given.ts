// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.
import { PASSWORD_MAX } from "@todo/business/rules.ts";
import type { Problem } from "../problem.ts";

/**
 * `password.given`: A password is 1 to `max` long, counted in UTF-16 code
 * units. It is never trimmed and never lower-cased. Sign-in applies only this;
 * the minimum is a set-time rule (L47). Gives the problem of the first
 * violation, or undefined when the rule holds.
 */
export const passwordGiven = (field: "password", value: string): Problem | undefined => {
  if (value.length < 1) {
    return { field, rule: "password.given", violation: "empty", max: PASSWORD_MAX };
  }
  if (value.length > PASSWORD_MAX) {
    return { field, rule: "password.given", violation: "too_long", max: PASSWORD_MAX };
  }
  return undefined;
};
