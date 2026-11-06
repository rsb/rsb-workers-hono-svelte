// The access generator, run as CI runs it, from the repo root: --check
// passes on the committed table, and each way the spec and construct can
// part is refused.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const SPEC = "prd/todo/access.md";
const CONSTRUCT = "apps/api/src/construct.ts";

const run = (args: string[]) => spawnSync(process.execPath, ["tooling/access/generate.ts", ...args], { encoding: "utf8" });

const scratch = mkdtempSync(join(tmpdir(), "access-"));

/** The spec, edited, beside a copy of the use cases it names; and a business dir to write into. */
const edited = (name: string, edit: (text: string) => string) => {
  const root = join(scratch, name);
  cpSync("prd/todo/use-cases", join(root, "use-cases"), { recursive: true });
  const spec = join(root, "access.md");
  writeFileSync(spec, edit(readFileSync(SPEC, "utf8")));
  const business = join(root, "business");
  mkdirSync(join(business, "src"), { recursive: true });
  return { spec, business };
};

describe("access generate --check", () => {
  it("passes on the committed table", () => {
    const result = run([SPEC, CONSTRUCT, "packages/business", "--check"]);
    assert.equal(result.status, 0, result.stderr);
  });

  it("fails on a stale table, naming the command to run", () => {
    const { business } = edited("stale", (text) => text);
    writeFileSync(join(business, "src", "access.ts"), "// edited by hand\n");
    const result = run([SPEC, CONSTRUCT, business, "--check"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /differs from what .* generates; run pnpm gen:access/);
  });
});

describe("access generate", () => {
  it("fails on an operation construct builds that has no row", () => {
    const { spec, business } = edited("missing", (text) => text.replace(/^\| `currentSession` .*\n/m, ""));
    const result = run([spec, CONSTRUCT, business]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /construct builds currentSession, which has no row/);
  });

  it("fails on a row that names an operation construct does not build", () => {
    const row = "| `renameList` | `use-cases/todos/list-todos.md` | `member` | `own` |\n";
    const { spec, business } = edited("ghost", (text) => text.replace(/^(\| `currentSession` .*\n)/m, `$1${row}`));
    const result = run([spec, CONSTRUCT, business]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /renameList has a row, but construct does not build it/);
  });

  it("fails on a row whose use case is not a file beside the spec", () => {
    const { spec, business } = edited("no-use-case", (text) => text.replace("use-cases/todos/add-a-todo.md", "use-cases/todos/add.md"));
    const result = run([spec, CONSTRUCT, business]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /addTodo's use case use-cases\/todos\/add.md is not a file beside the spec/);
  });
});
