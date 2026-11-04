/**
 * Why a candidate is not an input: the field, the rule it breaks, and the
 * rule's parameters. A problem carries all of its rule's parameters, not
 * only the ones the violation touched: an empty title and a long one break
 * one rule, so both carry `max`. A problem carries no words; each delivery
 * words it for the person or program it answers (L27).
 *
 * Two kinds of rule:
 * - decode rules are generic, named by the type the field needs
 *   (`not_text`, `not_boolean`), with the field beside them;
 * - check rules are named after the business rule they guard
 *   (`title.empty`, `title.too_long`, `patch.empty`). Use cases cite them,
 *   so they do not change.
 */
export type Problem =
  | { field: Field; rule: "not_text" }
  | { field: Field; rule: "not_boolean" }
  | { field: "title"; rule: "title.empty"; max: number }
  | { field: "title"; rule: "title.too_long"; max: number }
  | { rule: "patch.empty" };

/** A field a candidate can carry. */
export type Field = "title" | "completed";

/** Every problem a candidate has, in the order its rules ran. Never empty. */
export type Problems = [Problem, ...Problem[]];
