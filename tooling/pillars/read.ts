// The readers behind the pillars view (logbook/pillars.md): the threats
// table, and the two test runners' JSON reports. Each takes the text it
// reads and returns plain counts; none reads a file or judges a number.

/** One row of the threats table: its number, its threat, and whether its Test cell names a test. */
export type ThreatRow = { number: string; threat: string; tested: boolean };

/** A table row's cells, the outer pipes dropped and each cell trimmed. */
const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

/**
 * The rows of the threats table in `text`: each line of a table whose first
 * cell is a number. The Test cell is the last; an empty one is a threat with
 * no test yet. A row with a cell missing is a problem, named by its number.
 */
export const threatRows = (text: string): { ok: true; rows: ThreatRow[] } | { ok: false; problem: string } => {
  const rows: ThreatRow[] = [];
  for (const line of text.split("\n")) {
    if (!line.trimStart().startsWith("|")) {
      continue;
    }
    const [number, threat, ...rest] = cells(line);
    if (number === undefined || !/^\d+$/.test(number)) {
      continue;
    }
    if (rest.length !== 4) {
      return { ok: false, problem: `row ${number} has ${rest.length + 2} cells, not 6` };
    }
    rows.push({ number, threat: threat ?? "", tested: (rest[3] ?? "") !== "" });
  }
  if (rows.length === 0) {
    return { ok: false, problem: "no threats table: no row starts with a number" };
  }
  return { ok: true, rows };
};

/** Tests run, by outcome. */
export type Counts = { passed: number; failed: number; skipped: number };

/** One test file's counts, its path as the report gives it. */
export type FileCounts = Counts & { file: string };

const SKIPPED = new Set(["pending", "skipped", "todo"]);

/**
 * A vitest JSON report's tests, counted per file: `passed`, `failed`, and
 * skipped (`pending`, `skipped` or `todo`). Anything else is a problem.
 */
export const vitestCounts = (json: string): { ok: true; files: FileCounts[] } | { ok: false; problem: string } => {
  let report: unknown;
  try {
    report = JSON.parse(json);
  } catch {
    return { ok: false, problem: "not JSON" };
  }
  const results = (report as { testResults?: unknown }).testResults;
  if (!Array.isArray(results)) {
    return { ok: false, problem: "not a vitest report: it has no testResults" };
  }
  const files: FileCounts[] = [];
  for (const each of results as { name?: unknown; assertionResults?: unknown }[]) {
    if (typeof each.name !== "string" || !Array.isArray(each.assertionResults)) {
      return { ok: false, problem: "not a vitest report: a file has no name or no results" };
    }
    const counts = { file: each.name, passed: 0, failed: 0, skipped: 0 };
    for (const { status } of each.assertionResults as { status?: unknown }[]) {
      if (status === "passed") {
        counts.passed += 1;
      } else if (status === "failed") {
        counts.failed += 1;
      } else if (typeof status === "string" && SKIPPED.has(status)) {
        counts.skipped += 1;
      } else {
        return { ok: false, problem: `not a vitest report: a test in ${each.name} has the status ${String(status)}` };
      }
    }
    files.push(counts);
  }
  return { ok: true, files };
};

/**
 * A Playwright JSON report's totals, from its `stats`: `expected` passed;
 * `unexpected` and `flaky` failed (a flaky test failed a try, and the lab
 * runs no retries); `skipped` skipped.
 */
export const playwrightCounts = (json: string): { ok: true; counts: Counts } | { ok: false; problem: string } => {
  let report: unknown;
  try {
    report = JSON.parse(json);
  } catch {
    return { ok: false, problem: "not JSON" };
  }
  const stats = (report as { stats?: Record<string, unknown> }).stats;
  const count = (key: string) => stats?.[key];
  const keys = ["expected", "unexpected", "flaky", "skipped"];
  if (stats === undefined || !keys.every((key) => typeof count(key) === "number")) {
    return { ok: false, problem: `not a Playwright report: its stats do not give ${keys.join(", ")}` };
  }
  const n = (key: string) => count(key) as number;
  return { ok: true, counts: { passed: n("expected"), failed: n("unexpected") + n("flaky"), skipped: n("skipped") } };
};

/** Two counts added. */
export const add = (a: Counts, b: Counts): Counts => ({
  passed: a.passed + b.passed,
  failed: a.failed + b.failed,
  skipped: a.skipped + b.skipped,
});
