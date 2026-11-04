import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { readReport } from "./report.ts";

/** A tests directory with one test file, and a report path beside it, in a fresh directory. */
const scratch = () => {
  const root = mkdtempSync(join(tmpdir(), "join-report-"));
  const tests = join(root, "test", "unit");
  mkdirSync(join(tests, "todos"), { recursive: true });
  const testFile = join(tests, "todos", "add-todo.test.ts");
  writeFileSync(testFile, "");
  utimesSync(testFile, 1000, 1000);
  return { root, tests, testFile, report: join(root, "unit.json") };
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
    const read = readReport(report, tests, "pnpm test:unit");
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
    assert.deepEqual(readReport(report, tests, "pnpm test:unit"), {
      ok: false,
      problem: `${report}: no test report; run pnpm test:unit first`,
    });
  });

  it("refuses a report older than a test file", () => {
    const { tests, testFile, report } = scratch();
    writeFileSync(report, vitest(testFile));
    utimesSync(report, 500, 500);
    assert.deepEqual(readReport(report, tests, "pnpm test:unit"), {
      ok: false,
      problem: `${report}: older than ${testFile}; run pnpm test:unit again`,
    });
  });

  it("refuses a file that is not a report", () => {
    const { tests, report } = scratch();
    writeFileSync(report, JSON.stringify({ tests: [] }));
    assert.deepEqual(readReport(report, tests, "pnpm test:unit"), {
      ok: false,
      problem: `${report}: not a test report: it has no testResults`,
    });
  });
});
