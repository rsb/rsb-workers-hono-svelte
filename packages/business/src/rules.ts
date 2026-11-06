// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.

/** The longest title, after trim. */
export const TITLE_MAX = 256;

/** The most todos one owner's list holds. */
export const TODO_LIMIT = 500;

/**
 * The longest email, after trim: RFC 5321's longest path, less its angle
 * brackets.
 */
export const EMAIL_MAX = 254;

/**
 * The shortest password that may be set (L47). Applied by the set-time rule
 * slice C writes; sign-in never applies it, so raising it cannot lock anyone
 * out.
 */
export const PASSWORD_MIN = 15;

/**
 * The longest password, a request bound: the hash is given a fixed 32 bytes
 * whatever the length (L48).
 */
export const PASSWORD_MAX = 128;

/**
 * The most sessions one list of a user's sessions returns, the most recently
 * active first.
 */
export const SESSIONS_LIST_MAX = 50;

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
  | "email.length"
  | "email.shape"
  | "password.given"
  | "todos.cap"
  | "todo.exists"
  | "todo.owned"
  | "todos.order"
  | "todos.unique_id"
  | "todos.scoped";

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
  "email.length": {
    kind: "input",
    statement: "An email is 1 to `max` long, counted in UTF-16 code units.",
    parameters: { max: EMAIL_MAX },
    violations: ["empty", "too_long"],
    source: "L47.",
  },
  "email.shape": {
    kind: "input",
    statement: "An email is a WHATWG \"valid email address\", the definition `<input type=email>` applies, so the browser and the api never disagree. Not RFC 5322. It is ASCII only, which keeps `users.email`'s `CHECK (email = lower(email))` honest, since SQLite folds ASCII only.",
    parameters: {},
    violations: ["malformed"],
    source: "L47.",
  },
  "password.given": {
    kind: "input",
    statement: "A password is 1 to `max` long, counted in UTF-16 code units. It is never trimmed and never lower-cased. Sign-in applies only this; the minimum is a set-time rule (L47).",
    parameters: { max: PASSWORD_MAX },
    violations: ["empty", "too_long"],
    source: "L47.",
  },
  "todos.cap": {
    kind: "state",
    statement: "The owner's list holds fewer than `limit` todos when one is added.",
    parameters: { limit: TODO_LIMIT },
    violations: [],
    source: "PRD deviation 9; per owner from deviation 21.",
  },
  "todo.exists": {
    kind: "state",
    statement: "A todo has the id.",
    parameters: {},
    violations: [],
    source: "PRD › API, `PATCH /todos/:id` and `DELETE /todos/:id` (404).",
  },
  "todo.owned": {
    kind: "state",
    statement: "The todo with the id is in the actor's scope. Another's todo is `not_found`, the same as a missing one, so a caller cannot tell whether another's id exists.",
    parameters: {},
    violations: [],
    source: "PRD deviation 21; L43.",
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
  "todos.scoped": {
    kind: "guarantee",
    statement: "Every todo a store call reads or writes is in the scope it is given.",
    parameters: {},
    violations: [],
    source: "L43: the store has no default scope, and reads and writes are scoped alike.",
  },
};
