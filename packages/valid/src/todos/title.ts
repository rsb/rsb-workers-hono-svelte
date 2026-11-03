import { type Result, err, ok } from "@todo/business/result.ts";
import { TITLE_MAX } from "@todo/business/todos/todo.ts";

/** Why a title is not valid. Each app turns it into its own failure or message. */
export type TitleProblem = "empty" | "too_long";

/**
 * A title is trimmed, then must be 1 to `TITLE_MAX` UTF-16 code units long.
 * Gives the trimmed title.
 */
export const checkTitle = (raw: string): Result<string, TitleProblem> => {
  const title = raw.trim();
  if (title.length === 0) {
    return err("empty");
  }

  if (title.length > TITLE_MAX) {
    return err("too_long");
  }

  return ok(title);
};
