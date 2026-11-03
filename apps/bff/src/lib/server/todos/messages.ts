import { TITLE_MAX, TODO_LIMIT } from "@todo/business/todos/todo.ts";
import type { ErrorKind } from "@todo/contract-api";

/**
 * Every message the person using the app can see. The BFF writes them from
 * the kind of failure; the API's own message is for developers and is never
 * shown (PRD, Envelope).
 */

/** The title is empty after trim, or longer than `TITLE_MAX`. */
export const TITLE_RULE = `Title must be 1 to ${TITLE_MAX} characters`;

/** The list already holds `TODO_LIMIT` todos. */
export const LIST_FULL = `This list is full — it holds ${TODO_LIMIT} to-dos. Clear completed or remove some to add more.`;

/** Anything the person cannot fix by changing what they typed. */
export const SOMETHING_WENT_WRONG = "Something went wrong. Try again.";

/** The message for a failed add, from the kind the API answered with. */
export const addFailedMessage = (kind: ErrorKind): string => {
  if (kind === "validation") {
    return TITLE_RULE;
  }

  if (kind === "limit") {
    return LIST_FULL;
  }

  return SOMETHING_WENT_WRONG;
};
