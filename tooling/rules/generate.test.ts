// The rules generator, run as CI runs it, from the repo root: --check
// passes on the committed files and fails on a stale one, and a fixture
// with a custom rule shows what the generator owns and what it only checks.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { TITLE_INPUT, TITLE_RULE, spec } from "./fixtures.ts";

const run = (args: string[]) => spawnSync(process.execPath, ["tooling/rules/generate.ts", ...args], { encoding: "utf8" });

const scratch = mkdtempSync(join(tmpdir(), "rules-"));

/** A copy of business's and valid's sources in a fresh directory. */
const copies = (name: string) => {
  const root = join(scratch, name);
  for (const pkg of ["business", "valid"]) {
    cpSync(join("packages", pkg, "src"), join(root, pkg, "src"), { recursive: true });
    cpSync(join("packages", pkg), join(root, pkg), {
      recursive: true,
      filter: (path) => !path.includes("node_modules") && !path.includes(`${pkg}/src`),
    });
  }
  return { business: join(root, "business"), valid: join(root, "valid") };
};

describe("rules generate --check", () => {
  it("passes on the committed files", () => {
    const result = run(["prd/todo/rules.md", "prd/todo/use-cases", "packages/business", "packages/valid", "--check"]);
    assert.equal(result.status, 0, result.stderr);
  });

  it("fails on a stale validator, naming the command to run", () => {
    const { business, valid } = copies("stale");
    writeFileSync(join(valid, "src", "todos", "new-todo.ts"), "// edited by hand\n", { flag: "a" });
    const result = run(["prd/todo/rules.md", "prd/todo/use-cases", business, valid, "--check"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /new-todo\.ts differs from what prd\/todo\/rules\.md .* generates; run pnpm gen:rules/);
  });

  it("fails on a file in rules/ that no rule generates or owns", () => {
    const { business, valid } = copies("stray");
    writeFileSync(join(valid, "src", "rules", "title-short.ts"), "export const id = \"title.short\";\n");
    const result = run(["prd/todo/rules.md", "prd/todo/use-cases", business, valid, "--check"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /title-short\.ts: no rule in prd\/todo\/rules\.md generates or owns this file; delete it/);
  });

  it("fails on a use case that cites a rule in the wrong section", () => {
    const { business, valid } = copies("citation");
    const useCases = join(scratch, "citation", "use-cases");
    mkdirSync(useCases, { recursive: true });
    const add = readFileSync("prd/todo/use-cases/todos/add-a-todo.md", "utf8");
    writeFileSync(join(useCases, "add-a-todo.md"), add.replace("## Given\n- `todos.cap`", "## Given\n- `todos.order`"));
    const result = run(["prd/todo/rules.md", useCases, business, valid, "--check"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /add-a-todo\.md:17: todos\.order is a guarantee rule, but Given cites state rules/);
  });
});

describe("rules generate with a custom rule", () => {
  const root = join(scratch, "custom");
  const paths = { spec: join(root, "rules.md"), useCases: join(root, "use-cases"), business: join(root, "business"), valid: join(root, "valid") };
  const input = TITLE_INPUT.replace("  - `title.length`\n", "  - `title.length`\n  - `title.plain`\n");
  const custom = "\n### `title.plain`\nA title has no markup.\nKind: input\nForm: custom\n\nViolations:\n- `markup`\n\nSource: a test.\n";
  mkdirSync(paths.useCases, { recursive: true });
  writeFileSync(paths.spec, spec(input, TITLE_RULE + custom));
  const generate = (...extra: string[]) => run([paths.spec, paths.useCases, paths.business, paths.valid, ...extra]);
  const customFile = join(paths.valid, "src", "rules", "title-plain.ts");

  it("fails while the custom rule's file is missing", () => {
    const result = generate();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /title-plain\.ts: title\.plain is custom, so this file is written by hand, and it is missing/);
  });

  it("fails while the custom rule's file does not export its id", () => {
    mkdirSync(join(paths.valid, "src", "rules"), { recursive: true });
    writeFileSync(customFile, "export const titlePlain = () => undefined;\n");
    const result = generate();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /a custom rule's file exports its id: export const id = "title\.plain";/);
  });

  it("generates around the custom rule, applying it after the generated one, and leaves its file alone", () => {
    const written = 'export const id = "title.plain";\nexport const titlePlain = () => undefined;\n';
    writeFileSync(customFile, written);
    const result = generate();
    assert.equal(result.status, 0, result.stderr);
    const validator = readFileSync(join(paths.valid, "src", "todos", "new-todo.ts"), "utf8");
    assert.match(validator, /import \{ titlePlain \} from "\.\.\/rules\/title-plain\.ts";/);
    assert.ok(validator.indexOf('titleLength("title", applied)') < validator.indexOf('titlePlain("title", applied)'));
    const problem = readFileSync(join(paths.valid, "src", "problem.ts"), "utf8");
    assert.match(problem, /\| \{ field: "title"; rule: "title\.plain"; violation: "markup" \};/);
    assert.equal(readFileSync(customFile, "utf8"), written);
    assert.equal(generate("--check").status, 0);
  });
});
