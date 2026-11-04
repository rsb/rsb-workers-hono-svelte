import { type Result, err, ok } from "@todo/business/result.ts";
import { TITLE_MAX } from "@todo/business/todos/todo.ts";
import type { Problem } from "../problem.ts";
import { text } from "./decode.ts";

/**
 * A title: decoded as text, trimmed, then checked to be 1 to `TITLE_MAX`
 * long, counted in UTF-16 code units (PRD deviation 7). The rules run in
 * that order, so a title has at most one problem. Gives the trimmed title.
 */
export const title = (value: unknown): Result<string, Problem> => {
  const decoded = text("title", value);
  if (!decoded.ok) {
    return decoded;
  }

  const trimmed = decoded.value.trim();
  if (trimmed.length === 0) {
    return err({ field: "title", rule: "title.empty", max: TITLE_MAX });
  }

  if (trimmed.length > TITLE_MAX) {
    return err({ field: "title", rule: "title.too_long", max: TITLE_MAX });
  }

  return ok(trimmed);
};
