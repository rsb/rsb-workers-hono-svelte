/**
 * Why a candidate is not an input: the rule it breaks, the field the rule
 * was applied to, how it was broken, and the rule's parameters. A problem
 * carries all of its rule's parameters, not only the ones the violation
 * touched: an empty title and a long one break one rule, so both carry
 * `max`. A problem carries no words; each delivery words it for the person
 * or program it answers (L27).
 *
 * Two kinds of rule:
 * - decode rules are generic, named by the type the field needs
 *   (`not_text`, `not_boolean`), with the field beside them, and are not
 *   cited;
 * - input rules are the ones `prd/todo/rules.md` defines (`title.length`,
 *   `patch.nonempty`), each with a `violation` naming how it was broken.
 *   Use cases cite them by id (L33).
 */
export type Problem =
  | { field: Field; rule: "not_text" }
  | { field: Field; rule: "not_boolean" }
  | { field: "title"; rule: "title.length"; violation: "empty" | "too_long"; max: number }
  | { rule: "patch.nonempty"; violation: "empty" };

/** A field a candidate can carry. */
export type Field = "title" | "completed";

/** Every problem a candidate has, in the order its rules ran. Never empty. */
export type Problems = [Problem, ...Problem[]];
