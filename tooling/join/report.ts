// Reads a test runner's JSON report, as vitest's `json` reporter writes it,
// for the tests a rule names (L33). The join never runs a test itself: each
// tier runs alone, by its own command, and writes its report; the join reads
// the file, and refuses it when it is missing or older than a watched file.
//
// A watched directory is watched whole, but a directory holding a
// `package.json` stands for its package: its `src/`, and the `src/` of each
// workspace package it depends on, found through its own `node_modules/`.
// So the tests and the code they run are watched alike, and a new
// dependency is watched the day it is added. Dependencies are followed one
// step, not further.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
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

type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

/**
 * The directories `dir` stands for: itself, or, when it holds a
 * `package.json`, its `src/` and each workspace dependency's `src/`. A
 * dependency that is not linked is a problem, named by its package.
 */
const watchedDirs = (dir: string): { ok: true; dirs: string[] } | { ok: false; problem: string } => {
  const manifestPath = join(dir, "package.json");
  if (!existsSync(manifestPath)) {
    return { ok: true, dirs: [dir] };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const workspace = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter(([, specifier]) => specifier.startsWith("workspace:"))
    .map(([name]) => name)
    .sort();
  const dirs = [join(dir, "src")];
  for (const name of workspace) {
    const link = join(dir, "node_modules", name);
    if (!existsSync(link)) {
      return { ok: false, problem: `${manifestPath}: ${name} is not linked; run pnpm install` };
    }
    dirs.push(join(relative(process.cwd(), realpathSync(link)), "src"));
  }
  return { ok: true, dirs };
};

/**
 * The tests in the report at `reportPath`, or the one problem that stops it
 * being read: it is missing, it is older than a file `watched` covers, or it
 * is not a report. `run` is the command that writes it.
 */
export const readReport = (reportPath: string, watched: string[], run: string): Report => {
  if (!existsSync(reportPath)) {
    return { ok: false, problem: `${reportPath}: no test report; run ${run} first` };
  }
  const dirs: string[] = [];
  for (const dir of watched) {
    const each = watchedDirs(dir);
    if (!each.ok) {
      return each;
    }
    dirs.push(...each.dirs);
  }
  const written = statSync(reportPath).mtimeMs;
  const newer = dirs.flatMap(filesUnder).filter((path) => statSync(path).mtimeMs > written);
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
