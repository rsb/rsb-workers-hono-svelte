// The access spec's table (L43): what a row may say, and what is refused.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emit, parse } from "./parse.ts";

const HEAD = ["# Access", "", "## Operations", "", "| Operation | Use case | Requires | Scope |", "| --- | --- | --- | --- |"];

const spec = (...rows: string[]) => [...HEAD, ...rows, "", "Prose after the table."].join("\n");

const problems = (text: string) => {
  const parsed = parse(text);
  assert.equal(parsed.ok, false);
  return parsed.ok ? [] : parsed.problems.map((problem) => problem.message);
};

describe("access parse", () => {
  it("reads each row, its line and its columns, and stops at the table's end", () => {
    const parsed = parse(spec("| `addTodo` | `use-cases/todos/add-a-todo.md` | `member` | `own` |"));
    assert.deepEqual(parsed, {
      ok: true,
      rows: [{ line: 7, operation: "addTodo", useCase: "use-cases/todos/add-a-todo.md", requires: "member", scope: "own" }],
    });
  });

  it("refuses a value outside each column's list", () => {
    assert.match(problems(spec("| `a` | `x.md` | `guest` | `own` |"))[0] ?? "", /requires guest, which is not one of/);
    assert.match(problems(spec("| `a` | `x.md` | `member` | `mine` |"))[0] ?? "", /the scope mine, which is not one of/);
  });

  it("refuses an operation named twice", () => {
    const row = "| `a` | `x.md` | `member` | `own` |";
    assert.match(problems(spec(row, row))[0] ?? "", /a has two rows/);
  });

  it("refuses a scope of rows for an anonymous actor, and any for a non-admin", () => {
    assert.match(problems(spec("| `a` | `x.md` | `anonymous` | `own` |"))[0] ?? "", /an anonymous actor has no rows for/);
    assert.match(problems(spec("| `a` | `x.md` | `member` | `any` |"))[0] ?? "", /only an admin is handed/);
  });

  it("refuses a cell not in backticks, and a table with no rows or no header", () => {
    assert.match(problems(spec("| a | `x.md` | `member` | `own` |"))[0] ?? "", /four cells, each one value in backticks/);
    assert.match(problems(spec())[0] ?? "", /no rows/);
    assert.match(problems("# Access\n")[0] ?? "", /no ## Operations/);
  });
});

describe("access emit", () => {
  it("writes one entry per row, in order, under the generated header", () => {
    const parsed = parse(spec("| `b` | `b.md` | `admin` | `any` |", "| `a` | `a.md` | `anonymous` | `n/a` |"));
    assert.ok(parsed.ok);
    const text = emit(parsed.rows, "spec.md", "script.ts");
    assert.ok(text.startsWith("// Generated from spec.md by script.ts. Do not edit"));
    assert.ok(
      text.includes(
        '  b: { useCase: "b.md", requires: "admin", scope: "any" },\n  a: { useCase: "a.md", requires: "anonymous", scope: "n/a" },\n',
      ),
    );
  });
});
