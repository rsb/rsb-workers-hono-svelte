// Renders the pillars view (logbook/pillars.md): each pillar's signal, read
// from the lab's own outputs, at the end of a stage. It judges nothing and
// gates nothing: it counts, and writes the counts down.
//
//   node tooling/pillars/view.ts <threats.md> <view.md>
//
// Run from the repo root, after the suites, in CI order: pnpm test:unit,
// pnpm test:integration, pnpm test:e2e. It reads
//
// - reliability: each package's test reports, found by its configs: a
//   vitest.unit.config.ts writes test-results/unit.json, a
//   vitest.integration.config.ts test-results/integration.json, and a
//   playwright.config.ts test-results/e2e.json. A report not there is
//   written down as not measured, with the command that writes it;
// - security: the threats table, the rows whose Test cell names a test;
// - performance: the budgets tests (each budgets.test.ts) in the unit reports;
// - maintainability: the five checks, run here as package.json runs them.
//
// It writes the view, and exits 0 whatever the signals say. It exits 1 when
// the threats table does not read or a report is not a report, and 2 on a
// usage error.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path/posix";
import { add, type Counts, type FileCounts, playwrightCounts, threatRows, vitestCounts } from "./read.ts";

const USAGE = "usage: node tooling/pillars/view.ts <threats.md> <view.md>";

/** The checks the maintainability signal is, by their package.json names. */
const CHECKS = ["check:api", "check:access", "check:rules", "check:entry-chains", "check:join"];

type Level = "unit" | "integration" | "e2e";

/** Each level: the config that says a package has it, and the command that writes its report. */
const LEVELS: { level: Level; config: string; run: string }[] = [
  { level: "unit", config: "vitest.unit.config.ts", run: "pnpm test:unit" },
  { level: "integration", config: "vitest.integration.config.ts", run: "pnpm test:integration" },
  { level: "e2e", config: "playwright.config.ts", run: "pnpm test:e2e" },
];

/** The workspace's package directories: apps/*, packages/* and packages/*\/*, each holding a package.json. */
const packageDirs = (): string[] => {
  const under = (dir: string): string[] =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
          .map((entry) => join(dir, entry.name))
      : [];
  const dirs = [...under("apps"), ...under("packages").flatMap((dir) => [dir, ...under(dir)])];
  return dirs.filter((dir) => existsSync(join(dir, "package.json"))).sort();
};

type ReportRow =
  | { level: Level; pkg: string; path: string; read: true; counts: Counts; files: FileCounts[]; written: string }
  | { level: Level; pkg: string; path: string; read: false; run: string };

/** Every report the configs say there should be, read or not there. */
const readReports = (): { ok: true; rows: ReportRow[] } | { ok: false; problem: string } => {
  const rows: ReportRow[] = [];
  for (const { level, config, run } of LEVELS) {
    for (const pkg of packageDirs().filter((dir) => existsSync(join(dir, config)))) {
      const path = join(pkg, "test-results", `${level}.json`);
      if (!existsSync(path)) {
        rows.push({ level, pkg, path, read: false, run });
        continue;
      }
      const text = readFileSync(path, "utf8");
      const written = statSync(path).mtime.toISOString().slice(0, 10);
      if (level === "e2e") {
        const read = playwrightCounts(text);
        if (!read.ok) {
          return { ok: false, problem: `${path}: ${read.problem}` };
        }
        rows.push({ level, pkg, path, read: true, counts: read.counts, files: [], written });
        continue;
      }
      const read = vitestCounts(text);
      if (!read.ok) {
        return { ok: false, problem: `${path}: ${read.problem}` };
      }
      const files = read.files.map((file) => ({ ...file, file: relative(process.cwd(), file.file) }));
      const counts = files.reduce<Counts>(add, { passed: 0, failed: 0, skipped: 0 });
      rows.push({ level, pkg, path, read: true, counts, files, written });
    }
  }
  return { ok: true, rows };
};

/** A check's result: it holds, or the lines it named. */
type CheckResult = { name: string; holds: boolean; output: string };

/** Runs a package.json script that is a `node <file> <args>` command, as pnpm would, without pnpm. */
const runCheck = (name: string, scripts: Record<string, string>): CheckResult => {
  const script = scripts[name];
  const [command, ...args] = script?.split(" ") ?? [];
  if (command !== "node") {
    return { name, holds: false, output: `package.json has no ${name} that is a node command` };
  }
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  const output = `${result.stderr}${result.stdout}`.trim();
  return { name, holds: result.status === 0, output };
};

const sum = (rows: ReportRow[]) =>
  rows.reduce<Counts>((total, row) => (row.read ? add(total, row.counts) : total), { passed: 0, failed: 0, skipped: 0 });

const total = (counts: Counts) => counts.passed + counts.failed + counts.skipped;

const render = (date: string, reports: ReportRow[], threats: { number: string; threat: string; tested: boolean }[], checks: CheckResult[]) => {
  const lines: string[] = [
    "# Pillars view",
    "",
    "Generated by `pnpm gen:pillars` (tooling/pillars/view.ts); never edit it",
    "by hand. Each signal is read from the lab's own outputs, after the",
    "suites run in CI order. What each pillar means, and why its signal is",
    "the one read, is [pillars.md](pillars.md).",
    "",
    `Rendered ${date}.`,
    "",
    "## Reliability",
    "",
    "The tests run and passed, by level.",
    "",
    "| Level | Package | Passed | Failed | Skipped | Report written |",
    "|---|---|---|---|---|---|",
  ];
  for (const row of reports) {
    lines.push(
      row.read
        ? `| ${row.level} | ${row.pkg} | ${row.counts.passed} | ${row.counts.failed} | ${row.counts.skipped} | ${row.written} |`
        : `| ${row.level} | ${row.pkg} | not measured: run \`${row.run}\` first | | | |`,
    );
  }
  lines.push("");
  for (const { level } of LEVELS) {
    const rows = reports.filter((row) => row.level === level);
    const missing = rows.filter((row) => !row.read).length;
    const counts = sum(rows);
    const unread = missing > 0 ? `; ${missing} of ${rows.length} reports not measured` : "";
    lines.push(`- ${level}: ${counts.passed} of ${total(counts)} passed${unread}.`);
  }

  const tested = threats.filter((row) => row.tested);
  lines.push(
    "",
    "## Security",
    "",
    `${tested.length} of ${threats.length} threats in [threats.md](threats.md) have a test.`,
    "",
  );
  const untested = threats.filter((row) => !row.tested);
  if (untested.length > 0) {
    lines.push("No test yet:", "");
    for (const row of untested) {
      lines.push(`- ${row.number}. ${row.threat}`);
    }
  }

  const budgets = reports.flatMap((row) => (row.read ? row.files : [])).filter((file) => file.file.endsWith("/budgets.test.ts"));
  const unmeasured = reports.filter((row) => row.level === "unit" && !row.read).map((row) => row.pkg);
  lines.push(
    "",
    "## Performance",
    "",
    "The budgets tests, from the unit reports. The budgets are written in the",
    "tests, so this view reads whether they hold, not the numbers.",
    "",
    "| Budgets | Passed | Failed |",
    "|---|---|---|",
  );
  for (const file of budgets) {
    lines.push(`| ${file.file} | ${file.passed} | ${file.failed} |`);
  }
  if (unmeasured.length > 0) {
    lines.push("", `Not measured: no unit report for ${unmeasured.join(", ")}.`);
  }

  lines.push("", "## Maintainability", "", "The checks, run as package.json runs them.", "");
  for (const check of checks) {
    if (check.holds) {
      lines.push(`- \`${check.name}\`: holds.`);
      continue;
    }
    lines.push(`- \`${check.name}\`: does not hold:`, "", "  ```", ...check.output.split("\n").map((line) => `  ${line}`), "  ```", "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
};

const main = (args: string[]) => {
  const [threatsPath, viewPath, ...rest] = args;
  if (threatsPath === undefined || viewPath === undefined || rest.length > 0) {
    console.error(USAGE);
    return 2;
  }

  const threats = threatRows(readFileSync(threatsPath, "utf8"));
  if (!threats.ok) {
    console.error(`${threatsPath}: ${threats.problem}`);
    return 1;
  }
  const reports = readReports();
  if (!reports.ok) {
    console.error(reports.problem);
    return 1;
  }
  const scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts;
  const checks = CHECKS.map((name) => runCheck(name, scripts));

  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(viewPath, render(date, reports.rows, threats.rows, checks));
  console.log(`wrote ${viewPath}`);
  return 0;
};

process.exitCode = main(process.argv.slice(2));
