import { type Fail, invalid } from "@todo/fail/fail.ts";
import type { Problem, Problems } from "@todo/valid/problem.ts";

/**
 * The api's words for a problem `valid` found (L27). `valid` names the rule;
 * the api words it for the developer who reads the reply. The words are the
 * ones `prd/todo/api.md`'s examples show. Every rule must have words, so a
 * new rule does not compile until it is given some.
 */
const message = (problem: Problem): string => {
  switch (problem.rule) {
    case "not_text":
      return `${problem.field} must be text`;
    case "not_boolean":
      return `${problem.field} must be true or false`;
    case "title.length":
      if (problem.violation === "empty") {
        return "title is empty";
      }
      return `title is longer than ${problem.max} characters`;
    case "patch.nonempty":
      return "body must have title, completed or both";
    case "email.length":
      if (problem.violation === "empty") {
        return "email is empty";
      }
      return `email is longer than ${problem.max} characters`;
    case "email.shape":
      return "email is not a valid email address";
    case "password.given":
      if (problem.violation === "empty") {
        return "password is empty";
      }
      return `password is longer than ${problem.max} characters`;
    default: {
      const unworded: never = problem;
      return unworded;
    }
  }
};

/**
 * The field the reply names: the problem's own, or `body` for a rule about
 * the body as a whole.
 */
const field = (problem: Problem): string => {
  if ("field" in problem) {
    return problem.field;
  }
  return "body";
};

/**
 * The first problem as an `invalid` failure. The envelope names one field,
 * so the api shows the first problem `valid` found.
 */
export const invalidOf = (problems: Problems): Fail<"invalid"> => {
  const [first] = problems;
  return invalid(field(first), message(first));
};
