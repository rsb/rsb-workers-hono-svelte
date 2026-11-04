import type { ErrorKind } from "@todo/contract-api";
import type { Problem } from "@todo/valid/problem.ts";

/**
 * Every message the person using the app can see. The BFF writes them from
 * the kind of failure; the API's own message is for developers and is never
 * shown (PRD, Envelope). A number in a message comes from the problem it
 * words, never from a business constant (L27): business constants stay in
 * business, valid and operations.
 */

/** The title's bounds, from the longest a title may be. */
const titleRule = (max: number) => `Title must be 1 to ${max} characters`;

/** The API refused an add because the list already holds all it may. */
export const LIST_FULL = "The list is full. Clear completed or remove some to add more.";

/** Anything the person cannot fix by changing what they typed. */
export const SOMETHING_WENT_WRONG = "Something went wrong. Try again.";

/**
 * The message for a problem `valid` found in a form (L27). `valid` names the
 * rule; the BFF words it for the person. A title that is empty or too long
 * gets the title rule, worded from the max the problem carries. A title
 * that is not text, a `completed` that is not true or false, or an empty
 * patch did not come from the page, and the person cannot fix them. Every
 * rule must have words, so a new rule does not compile until it is given
 * some.
 */
export const problemMessage = (problem: Problem): string => {
  switch (problem.rule) {
    case "title.empty":
    case "title.too_long":
      return titleRule(problem.max);
    case "not_text":
    case "not_boolean":
    case "patch.empty":
      return SOMETHING_WENT_WRONG;
    default: {
      const unworded: never = problem;
      return unworded;
    }
  }
};

/**
 * The message for a failed add, from the kind the API answered with. The BFF
 * checked the title before sending it, so a `validation` answer is skew or a
 * bug, not something the person can fix: it gets the generic message.
 */
export const addFailedMessage = (kind: ErrorKind): string => {
  if (kind === "limit") {
    return LIST_FULL;
  }

  return SOMETHING_WENT_WRONG;
};
