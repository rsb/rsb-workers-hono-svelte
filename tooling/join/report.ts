// Reads a test runner's JSON report, as vitest's `json` reporter writes it,
// for the tests a rule names (L33). The join never runs a test itself: each
// tier runs alone, by its own command, and writes its report; the join reads
// the file, and refuses it when it is missing or older than the tests.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path/posix";

/** One test as the report gives it: its file, its own title, and its status. */
export type TestResult = { file: string; title: string; status: string };

export type Report = { ok: true; tests: TestResult[] } | { ok: false; problem: string };

/** Every file under `dir`, at any depth. */
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });

/**
 * The tests in the report at `reportPath`, or the one problem that stops it
 * being read: it is missing, it is older than a file under `testsDir`, or it
 * is not a report. `run` is the command that writes it.
 */
export const readReport = (reportPath: string, testsDir: string, run: string): Report => {
  if (!existsSync(reportPath)) {
    return { ok: false, problem: `${reportPath}: no test report; run ${run} first` };
  }
  const written = statSync(reportPath).mtimeMs;
  const newer = filesUnder(testsDir).filter((path) => statSync(path).mtimeMs > written);
  if (newer.length > 0) {
    return { ok: false, problem: `${reportPath}: older than ${newer.join(", ")}; run ${run} again` };
  }

  let report: unknown;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    return { ok: false, problem: `${reportPath}: not JSON; run ${run} again` };
  }
  const files = (report as { testResults?: unknown }).testResults;
  if (!Array.isArray(files)) {
    return { ok: false, problem: `${reportPath}: not a test report: it has no testResults` };
  }
  const tests: TestResult[] = [];
  for (const each of files as { name?: unknown; assertionResults?: unknown }[]) {
    if (typeof each.name !== "string" || !Array.isArray(each.assertionResults)) {
      return { ok: false, problem: `${reportPath}: not a test report: a file has no name or no results` };
    }
    const file = relative(process.cwd(), each.name);
    for (const result of each.assertionResults as { title?: unknown; status?: unknown }[]) {
      if (typeof result.title !== "string" || typeof result.status !== "string") {
        return { ok: false, problem: `${reportPath}: not a test report: a test in ${file} has no title or no status` };
      }
      tests.push({ file, title: result.title, status: result.status });
    }
  }
  return { ok: true, tests };
};
