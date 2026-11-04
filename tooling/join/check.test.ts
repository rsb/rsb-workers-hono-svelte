// The join, run on the repo as CI runs it, from the repo root. The unit
// report is test:unit's, and the join never runs a tier itself, so the
// report may be missing or older than the tests here. Either way the repo
// must join: no problem but the report's own. With a fresh report, the join
// passes.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const REPORT = "packages/operations/test-results/unit.json";

const args = [
  "tooling/join/check.ts",
  "prd/todo/rules.md",
  "prd/todo/use-cases",
  "prd/todo/api.md",
  "apps/api/src/construct.ts",
  REPORT,
  "packages/operations/test/unit",
  "packages/operations",
];

describe("join check on the repo", () => {
  it("finds no problem but a missing or stale unit report", () => {
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    const problems = result.stderr.split("\n").filter((line) => line !== "");
    const others = problems.filter((line) => !line.startsWith(`${REPORT}: `));
    assert.deepEqual(others, []);
    assert.equal(result.status, problems.length === 0 ? 0 : 1);
  });

  it("refuses to run with the wrong arguments", () => {
    const result = spawnSync(process.execPath, args.slice(0, 3), { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage: node tooling\/join\/check\.ts/);
  });
});
