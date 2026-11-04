import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { readReport } from "./report.ts";

/** An empty file at `path`, written at time 1000. */
const old = (path: string) => {
  writeFileSync(path, "");
  utimesSync(path, 1000, 1000);
};

/**
 * In a fresh directory: a package, `ops`, with one test file and one source
 * file, depending on a workspace package, `dep`, linked as pnpm links it,
 * with one source file; and a report path beside the tests.
 */
const scratch = () => {
  const root = mkdtempSync(join(tmpdir(), "join-report-"));
  const pkg = join(root, "ops");
  const tests = join(pkg, "test", "unit");
  mkdirSync(join(tests, "todos"), { recursive: true });
  mkdirSync(join(pkg, "src", "todos"), { recursive: true });
  mkdirSync(join(root, "dep", "src"), { recursive: true });
  mkdirSync(join(pkg, "node_modules", "@todo"), { recursive: true });
  writeFileSync(
    join(pkg, "package.json"),
    JSON.stringify({ dependencies: { "@todo/dep": "workspace:*", valibot: "catalog:" } }),
  );
  symlinkSync(join("..", "..", "..", "dep"), join(pkg, "node_modules", "@todo", "dep"));
  const testFile = join(tests, "todos", "add-todo.test.ts");
  const sourceFile = join(pkg, "src", "todos", "add-todo.ts");
  const depFile = join(root, "dep", "src", "result.ts");
  for (const file of [testFile, sourceFile, depFile]) {
    old(file);
  }
  return { pkg, tests, testFile, sourceFile, depFile, report: join(pkg, "unit.json") };
};

const vitest = (file: string) =>
  JSON.stringify({
    testResults: [
      {
        name: file,
        assertionResults: [
          { title: "todos.cap: names a limit failure", status: "passed" },
          { title: "wraps the store's failure", status: "failed" },
        ],
      },
    ],
  });

describe("readReport", () => {
  it("reads each test's file, title and status", () => {
    const { tests, testFile, report } = scratch();
    writeFileSync(report, vitest(testFile));
    const read = readReport(report, [tests], "pnpm test:unit");
    assert.ok(read.ok, !read.ok ? read.problem : "");
    assert.deepEqual(
      read.tests.map((test) => [test.title, test.status]),
      [
        ["todos.cap: names a limit failure", "passed"],
        ["wraps the store's failure", "failed"],
      ],
    );
  });

  it("refuses a report that is missing, naming the command that writes it", () => {
    const { tests, report } = scratch();
    assert.deepEqual(readReport(report, [tests], "pnpm test:unit"), {
      ok: false,
      problem: `${report}: no test report; run pnpm test:unit first`,
    });
  });

  it("refuses a report older than a test file", () => {
    const { tests, testFile, report } = scratch();
    writeFileSync(report, vitest(testFile));
    utimesSync(report, 500, 500);
    assert.deepEqual(readReport(report, [tests], "pnpm test:unit"), {
      ok: false,
      problem: `${report}: older than ${testFile}; run pnpm test:unit again`,
    });
  });

  it("refuses a report older than a source file of the package", () => {
    const { pkg, tests, testFile, sourceFile, report } = scratch();
    writeFileSync(report, vitest(testFile));
    utimesSync(report, 1500, 1500);
    utimesSync(sourceFile, 2000, 2000);
    assert.deepEqual(readReport(report, [tests, pkg], "pnpm test:unit"), {
      ok: false,
      problem: `${report}: older than ${sourceFile}; run pnpm test:unit again`,
    });
  });

  it("refuses a report older than a source file of a workspace dependency", () => {
    const { pkg, tests, testFile, depFile, report } = scratch();
    writeFileSync(report, vitest(testFile));
    utimesSync(report, 1500, 1500);
    utimesSync(depFile, 2000, 2000);
    const named = relative(process.cwd(), realpathSync(depFile));
    assert.deepEqual(readReport(report, [tests, pkg], "pnpm test:unit"), {
      ok: false,
      problem: `${report}: older than ${named}; run pnpm test:unit again`,
    });
  });

  it("reads a report newer than the package and its dependencies", () => {
    const { pkg, tests, testFile, report } = scratch();
    writeFileSync(report, vitest(testFile));
    utimesSync(report, 1500, 1500);
    const read = readReport(report, [tests, pkg], "pnpm test:unit");
    assert.ok(read.ok, !read.ok ? read.problem : "");
  });

  it("refuses to read when a workspace dependency is not linked", () => {
    const { pkg, tests, testFile, report } = scratch();
    writeFileSync(report, vitest(testFile));
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ devDependencies: { "@todo/gone": "workspace:*" } }));
    assert.deepEqual(readReport(report, [tests, pkg], "pnpm test:unit"), {
      ok: false,
      problem: `${join(pkg, "package.json")}: @todo/gone is not linked; run pnpm install`,
    });
  });

  it("refuses a file that is not a report", () => {
    const { tests, report } = scratch();
    writeFileSync(report, JSON.stringify({ tests: [] }));
    assert.deepEqual(readReport(report, [tests], "pnpm test:unit"), {
      ok: false,
      problem: `${report}: not a test report: it has no testResults`,
    });
  });
});
