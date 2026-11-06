import type { Problem } from "@todo/valid/problem.ts";
import { SOMETHING_WENT_WRONG } from "../todos/messages.ts";

/**
 * The words of the sign-in page's fields (`feature-accounts-sign-in.md`,
 * Views); the page's own are in `#lib/sign-in.ts`. A number in a message
 * comes from the problem it words, never from a business constant (L27).
 */

/**
 * The message under a sign-in field for a problem `valid` found in it
 * (`accounts.sign_in.field_errors`). A field that is not text did not come
 * from the page, and the person cannot fix it. No sign-in field is a title,
 * `completed` or a patch, so those rules cannot reach here. Every rule must
 * have words, so a new rule does not compile until it is given some.
 */
export const fieldMessage = (problem: Problem): string => {
  switch (problem.rule) {
    case "email.length":
      if (problem.violation === "empty") {
        return "Email is required";
      }
      return `Email must be at most ${problem.max} characters`;
    case "email.shape":
      return "Enter a valid email address";
    case "password.given":
      if (problem.violation === "empty") {
        return "Password is required";
      }
      return `Password must be at most ${problem.max} characters`;
    case "not_text":
    case "not_boolean":
    case "title.length":
    case "patch.nonempty":
      return SOMETHING_WENT_WRONG;
    default: {
      const unworded: never = problem;
      return unworded;
    }
  }
};
