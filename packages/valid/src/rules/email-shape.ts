// Written by hand: `email.shape` is a custom rule (prd/todo/rules.md).
import type { Problem } from "../problem.ts";

export const id = "email.shape";

/**
 * The WHATWG "valid email address", as the HTML standard writes it for
 * `<input type=email>`: a local part of the listed ASCII characters, an
 * `@`, and labels of letters, digits and hyphens, each 1 to 63 long, not
 * starting or ending with a hyphen. ASCII only, as L47 needs.
 */
const VALID_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * `email.shape`: An email is a WHATWG "valid email address". Gives the
 * problem when it is not, or undefined when the rule holds.
 */
export const emailShape = (field: "email", value: string): Problem | undefined => {
  if (!VALID_EMAIL.test(value)) {
    return { field, rule: "email.shape", violation: "malformed" };
  }
  return undefined;
};
