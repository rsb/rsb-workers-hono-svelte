// Both generators, run as CI runs them: --check passes on the committed
// files, and fails, naming the command to run, on a file that is stale or
// missing. Each runs from the repo root, where `node --test` starts.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const run = (args: string[]) => spawnSync(process.execPath, args, { encoding: "utf8" });

const indexCheck = (index: string) =>
  run(["tooling/entry-chains/generate.ts", "apps/api/src/construct.ts", index, "--check"]);

const apiCheck = (openApi: string) =>
  run([
    "tooling/api-spec/generate.ts",
    "prd/todo/api.md",
    "prd/todo/access.md",
    "packages/contract/api/src",
    openApi,
    "apps/api/src/construct.ts",
    "--check",
  ]);

const scratch = mkdtempSync(join(tmpdir(), "generate-"));

describe("entry-chains generate --check", () => {
  it("passes on the committed index", () => {
    const result = indexCheck("apps/api/entry-chains.md");
    assert.equal(result.status, 0, result.stderr);
  });

  it("fails on a stale index, naming the command to run", () => {
    const stale = join(scratch, "stale.md");
    copyFileSync("apps/api/entry-chains.md", stale);
    writeFileSync(stale, "edited by hand\n", { flag: "a" });
    const result = indexCheck(stale);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /differs from what apps\/api\/src\/construct\.ts generates; run pnpm gen:entry-chains/);
  });

  it("fails on a missing index", () => {
    const result = indexCheck(join(scratch, "missing.md"));
    assert.equal(result.status, 1);
  });
});

describe("api-spec generate --check", () => {
  it("passes on the committed contract and openapi.json", () => {
    const result = apiCheck("apps/api/openapi.json");
    assert.equal(result.status, 0, result.stderr);
  });

  it("fails on a stale openapi.json, naming the command to run", () => {
    const stale = join(scratch, "openapi.json");
    writeFileSync(stale, "{}\n");
    const result = apiCheck(stale);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /differs from what prd\/todo\/api\.md and apps\/api\/src\/construct\.ts generate; run pnpm gen:api/);
  });
});
