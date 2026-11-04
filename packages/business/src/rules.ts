// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.

/** The longest title, after trim. */
export const TITLE_MAX = 256;

/** The most todos the list holds. */
export const TODO_LIMIT = 500;

/**
 * What a rule is (L29): an input rule is applied to an input, a state rule
 * holds of the state an operation is given, and a guarantee is kept by the
 * store.
 */
export type RuleKind = "input" | "state" | "guarantee";

/** Every rule's id. */
export type RuleId =
  | "title.length"
  | "patch.nonempty"
  | "todos.cap"
  | "todo.exists"
  | "todos.order"
  | "todos.unique_id";

/**
 * A rule as prd/todo/rules.md defines it: its kind, its statement, its
 * parameters, its violations and its source (L31). The words a person or a
 * program sees are each delivery's (L27).
 */
export type Rule = {
  kind: RuleKind;
  statement: string;
  parameters: Readonly<Record<string, number>>;
  violations: readonly string[];
  source: string;
};

/** Every rule, by id. */
export const RULES: Readonly<Record<RuleId, Rule>> = {
  "title.length": {
    kind: "input",
    statement: "A title is 1 to `max` long, counted in UTF-16 code units.",
    parameters: { max: TITLE_MAX },
    violations: ["empty", "too_long"],
    source: "PRD deviation 7.",
  },
  "patch.nonempty": {
    kind: "input",
    statement: "A patch gives a title, a `completed`, or both.",
    parameters: {},
    violations: ["empty"],
    source: "PRD › API, `PATCH /todos/:id` (\"at least one\").",
  },
  "todos.cap": {
    kind: "state",
    statement: "The list holds fewer than `limit` todos when one is added.",
    parameters: { limit: TODO_LIMIT },
    violations: [],
    source: "PRD deviation 9.",
  },
  "todo.exists": {
    kind: "state",
    statement: "A todo has the id.",
    parameters: {},
    violations: [],
    source: "PRD › API, `PATCH /todos/:id` and `DELETE /todos/:id` (404).",
  },
  "todos.order": {
    kind: "guarantee",
    statement: "Every list the store returns is in the order todos were added.",
    parameters: {},
    violations: [],
    source: "DB6, story chapter 8 › The D1 package: every select orders by `seq`.",
  },
  "todos.unique_id": {
    kind: "guarantee",
    statement: "No two todos share an id.",
    parameters: {},
    violations: [],
    source: "story chapter 8, the guarantees (L29). The id is a UUID from the id source (D13).",
  },
};
