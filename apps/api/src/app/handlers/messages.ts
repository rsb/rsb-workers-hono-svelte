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
    case "title.empty":
      return "title is empty";
    case "title.too_long":
      return `title is longer than ${problem.max} characters`;
    case "patch.empty":
      return "body must have title, completed or both";
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
