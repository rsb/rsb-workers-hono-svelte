import type { ApiError, Reason } from "@todo/contract-api";
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
    case "title.length":
      return titleRule(problem.max);
    case "not_text":
    case "not_boolean":
    case "patch.nonempty":
      return SOMETHING_WENT_WRONG;
    default: {
      const unworded: never = problem;
      return unworded;
    }
  }
};

/**
 * The message for a refused action, by its reason. Every reason gets the
 * generic message in slice A: `channel` is a request that did not come
 * from the page, `account_disabled` is `failed` until D, and `role` cannot
 * happen while every todo operation requires only a member. D words `role`
 * here. Every reason must have words, so a new one does not compile until
 * it is given some.
 */
const forbiddenMessage = (reason: Reason): string => {
  switch (reason) {
    case "channel":
    case "account_disabled":
    case "role":
      return SOMETHING_WENT_WRONG;
    default: {
      const unworded: never = reason;
      return unworded;
    }
  }
};

/**
 * The message for a failed action, from the error the API answered with:
 * `todos.list.action_failed` on the control whose action failed. The
 * person can fix none of them by changing what they typed: the BFF checked
 * it first, so `validation` is skew or a bug. `unauthenticated` is a
 * session that ended since the page loaded; the reload after the action
 * renders the shell's `signed_out`. Every kind must have words, so a new
 * one does not compile until it is given some.
 */
export const failedMessage = (failed: ApiError): string => {
  switch (failed.kind) {
    case "forbidden":
      return forbiddenMessage(failed.reason);
    case "validation":
    case "unauthenticated":
    case "not_found":
    case "limit":
    case "too_large":
    case "internal":
      return SOMETHING_WENT_WRONG;
    default: {
      const unworded: never = failed;
      return unworded;
    }
  }
};

/**
 * The message for a failed add: a full list says so, and every other
 * failure is worded as any action's is.
 */
export const addFailedMessage = (failed: ApiError): string => {
  if (failed.kind === "limit") {
    return LIST_FULL;
  }
  return failedMessage(failed);
};
