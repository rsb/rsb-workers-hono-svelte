// Reads an access spec's table of operations (`prd/todo/access.md`, L43)
// and writes business's access table from it. It holds no file system: the
// generator reads the files and checks the rows against construct.

/** The least actor an operation runs for, in the order each includes the next. */
export const REQUIRES = ["anonymous", "member", "verified_member", "admin"] as const;

/** What an operation hands the store. */
export const SCOPES = ["own", "any", "n/a"] as const;

export type Requires = (typeof REQUIRES)[number];
export type ScopeKind = (typeof SCOPES)[number];

/** One row: the operation, its use case's path from the spec's folder, and its two columns. */
export type Row = { line: number; operation: string; useCase: string; requires: Requires; scope: ScopeKind };

export type Problem = { line: number; message: string };

const HEADER = "| Operation | Use case | Requires | Scope |";
const SEPARATOR = "| --- | --- | --- | --- |";

/** A cell written `` `value` ``, or undefined. */
const ticked = (cell: string) => /^`([^`]+)`$/.exec(cell.trim())?.[1];

const isRequires = (value: string): value is Requires => (REQUIRES as readonly string[]).includes(value);
const isScope = (value: string): value is ScopeKind => (SCOPES as readonly string[]).includes(value);

/**
 * The rows under `## Operations`: the header, the separator, then one row
 * per line until the first line that is not a row. Each cell is one value
 * in backticks. An operation is named once. A scope of the actor's rows
 * needs an actor with rows: `own` and `any` are refused for `anonymous`,
 * and `any` is for `admin` alone.
 */
export const parse = (text: string): { ok: true; rows: Row[] } | { ok: false; problems: Problem[] } => {
  const lines = text.split("\n");
  const problems: Problem[] = [];
  const heading = lines.indexOf("## Operations");
  if (heading === -1) {
    return { ok: false, problems: [{ line: 1, message: "no ## Operations section" }] };
  }
  const header = lines.findIndex((line, index) => index > heading && line !== "");
  if (lines[header] !== HEADER || lines[header + 1] !== SEPARATOR) {
    return { ok: false, problems: [{ line: header + 1, message: `the table starts ${HEADER}, then ${SEPARATOR}` }] };
  }

  const rows: Row[] = [];
  const seen = new Set<string>();
  for (let index = header + 2; index < lines.length && (lines[index] ?? "").startsWith("|"); index++) {
    const line = index + 1;
    const cells = (lines[index] ?? "").split("|").slice(1, -1);
    const [operation, useCase, requires, scope] = cells.map(ticked);
    if (cells.length !== 4 || operation === undefined || useCase === undefined || requires === undefined || scope === undefined) {
      problems.push({ line, message: "a row is four cells, each one value in backticks" });
      continue;
    }
    if (!/^[a-z]\w*$/.test(operation)) {
      problems.push({ line, message: `${operation} is not an operation's name` });
      continue;
    }
    if (seen.has(operation)) {
      problems.push({ line, message: `${operation} has two rows; an operation has one` });
      continue;
    }
    seen.add(operation);
    if (!isRequires(requires)) {
      problems.push({ line, message: `${operation} requires ${requires}, which is not one of ${REQUIRES.join(", ")}` });
      continue;
    }
    if (!isScope(scope)) {
      problems.push({ line, message: `${operation} has the scope ${scope}, which is not one of ${SCOPES.join(", ")}` });
      continue;
    }
    if (scope !== "n/a" && requires === "anonymous") {
      problems.push({ line, message: `${operation} has the scope ${scope}, which an anonymous actor has no rows for` });
      continue;
    }
    if (scope === "any" && requires !== "admin") {
      problems.push({ line, message: `${operation} has the scope any, which only an admin is handed` });
      continue;
    }
    rows.push({ line, operation, useCase, requires, scope });
  }
  if (rows.length === 0 && problems.length === 0) {
    problems.push({ line: header + 1, message: "the table has no rows" });
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, rows };
};

/** Business's access table, as `packages/business/src/access.ts`. */
export const emit = (rows: readonly Row[], source: string, script: string): string => {
  const entries = rows.map(
    (row) =>
      `  ${row.operation}: { useCase: ${JSON.stringify(row.useCase)}, requires: ${JSON.stringify(row.requires)}, scope: ${JSON.stringify(row.scope)} },`,
  );
  return `// Generated from ${source} by ${script}. Do not edit: change the spec and regenerate.

/** The least actor an operation runs for: any request, a signed-in user, one whose email is verified, an admin. */
export type Requires = ${REQUIRES.map((each) => JSON.stringify(each)).join(" | ")};

/** What an operation hands the store: the actor's own rows, every row, or no owned row. */
export type ScopeKind = ${SCOPES.map((each) => JSON.stringify(each)).join(" | ")};

/** One operation's row: its use case, the least actor it runs for, and the scope it is handed. */
export type AccessRow = { readonly useCase: string; readonly requires: Requires; readonly scope: ScopeKind };

/** Every operation construct builds, with its row. The runner applies a row before the body runs. */
export const access = {
${entries.join("\n")}
} as const satisfies Record<string, AccessRow>;

/** An operation that has a row. */
export type OperationName = keyof typeof access;
`;
};
