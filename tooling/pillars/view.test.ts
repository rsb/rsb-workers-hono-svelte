// The pillars view's readers, on small reports, and the view itself, run as
// `pnpm gen:pillars` runs it, from the repo root, into a scratch file.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { playwrightCounts, threatRows, vitestCounts } from "./read.ts";

const run = (args: string[]) => spawnSync(process.execPath, ["tooling/pillars/view.ts", ...args], { encoding: "utf8" });

const scratch = mkdtempSync(join(tmpdir(), "pillars-"));

describe("reading the threats table", () => {
  it("reads each numbered row, and whether its Test cell names a test", () => {
    const text = [
      "| # | Threat | Mitigation | Source | Home | Test |",
      "|---|---|---|---|---|---|",
      "| 1 | CSRF | the gate | OWASP | gate | `channel.test.ts` |",
      "| 2 | Fixation | a new row | ASVS | operation | |",
    ].join("\n");
    assert.deepEqual(threatRows(text), {
      ok: true,
      rows: [
        { number: "1", threat: "CSRF", tested: true },
        { number: "2", threat: "Fixation", tested: false },
      ],
    });
  });

  it("refuses a row with a cell missing, and a text with no table", () => {
    assert.deepEqual(threatRows("| 3 | Enumeration | uniform | ASVS |"), { ok: false, problem: "row 3 has 4 cells, not 6" });
    assert.equal(threatRows("# Threats\n").ok, false);
  });

  it("reads the committed table: thirteen rows", () => {
    const read = threatRows(readFileSync("logbook/threats.md", "utf8"));
    assert.ok(read.ok);
    assert.equal(read.rows.length, 13);
  });
});

describe("reading the test reports", () => {
  it("counts a vitest report's tests per file, skipped as one outcome", () => {
    const report = {
      testResults: [
        { name: "/repo/a.test.ts", assertionResults: [{ status: "passed" }, { status: "failed" }, { status: "todo" }] },
        { name: "/repo/b.test.ts", assertionResults: [{ status: "skipped" }, { status: "pending" }] },
      ],
    };
    assert.deepEqual(vitestCounts(JSON.stringify(report)), {
      ok: true,
      files: [
        { file: "/repo/a.test.ts", passed: 1, failed: 1, skipped: 1 },
        { file: "/repo/b.test.ts", passed: 0, failed: 0, skipped: 2 },
      ],
    });
  });

  it("refuses what is not a vitest report", () => {
    assert.deepEqual(vitestCounts("{"), { ok: false, problem: "not JSON" });
    assert.equal(vitestCounts("{}").ok, false);
    assert.equal(vitestCounts('{"testResults":[{"name":"a","assertionResults":[{"status":"odd"}]}]}').ok, false);
  });

  it("counts a Playwright report from its stats, flaky as failed", () => {
    const report = { stats: { expected: 7, unexpected: 1, flaky: 1, skipped: 2 } };
    assert.deepEqual(playwrightCounts(JSON.stringify(report)), { ok: true, counts: { passed: 7, failed: 2, skipped: 2 } });
    assert.equal(playwrightCounts('{"stats":{"expected":1}}').ok, false);
  });
});

describe("the view", () => {
  it("writes each pillar's signal from the committed outputs", () => {
    const view = join(scratch, "pillars-view.md");
    const result = run(["logbook/threats.md", view]);
    assert.equal(result.status, 0, result.stderr);
    const text = readFileSync(view, "utf8");
    for (const heading of ["## Reliability", "## Security", "## Performance", "## Maintainability"]) {
      assert.match(text, new RegExp(`^${heading}$`, "m"));
    }
    assert.match(text, /^\d+ of 13 threats in \[threats\.md\]\(threats\.md\) have a test\.$/m);
    for (const check of ["check:api", "check:access", "check:rules", "check:entry-chains", "check:join"]) {
      assert.match(text, new RegExp(`^- \`${check}\`: (holds\\.|does not hold:)$`, "m"));
    }
  });

  it("refuses a threats file with no table", () => {
    const result = run(["package.json", join(scratch, "none.md")]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no threats table/);
  });

  it("answers a usage error with 2", () => {
    assert.equal(run(["logbook/threats.md"]).status, 2);
  });
});
