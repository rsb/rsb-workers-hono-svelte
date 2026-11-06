// The import rule between the inner packages (L37 for gates). pnpm already
// enforces it: a package resolves only what its package.json lists, so an
// import of an unlisted package fails to build. This test holds the lists
// themselves, so that adding a dependency the rule forbids fails here, by
// name, instead of passing quietly once pnpm install has run.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/** Each inner package and the workspace packages it may depend on. */
const MAY = {
  "@todo/business": [],
  "@todo/fail": [],
  "@todo/valid": ["@todo/business"],
  "@todo/operations": ["@todo/business", "@todo/fail"],
  "@todo/gates": ["@todo/business", "@todo/fail"],
  "@todo/data-d1": ["@todo/business", "@todo/fail"],
  "@todo/contract-api": [],
} as const satisfies Record<string, readonly string[]>;

type Manifest = { name: string; dependencies?: Record<string, string> };

/** Every package.json under packages/, at any depth, outside node_modules. */
const manifests = (dir: string): Manifest[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (!entry.isDirectory() || entry.name === "node_modules") {
      return entry.name === "package.json" ? [JSON.parse(readFileSync(path, "utf8")) as Manifest] : [];
    }
    return manifests(path);
  });

const workspaceDeps = (manifest: Manifest) =>
  Object.keys(manifest.dependencies ?? {}).filter((name) => name.startsWith("@todo/"));

const found = manifests("packages");

describe("the inner packages' dependencies", () => {
  it("names every package under packages/ in the rule", () => {
    assert.deepEqual(found.map((each) => each.name).sort(), Object.keys(MAY).sort());
  });

  for (const manifest of found) {
    it(`${manifest.name} depends only on what it may`, () => {
      const may: readonly string[] = MAY[manifest.name as keyof typeof MAY] ?? [];
      assert.deepEqual(workspaceDeps(manifest).filter((name) => !may.includes(name)), []);
    });
  }

  it("operations and data never depend on gates; gates never on operations, valid or data (L37)", () => {
    const deps = (name: string) => workspaceDeps(found.find((each) => each.name === name) ?? { name });
    assert.equal(deps("@todo/operations").includes("@todo/gates"), false);
    assert.equal(deps("@todo/data-d1").includes("@todo/gates"), false);
    for (const forbidden of ["@todo/operations", "@todo/valid", "@todo/data-d1"]) {
      assert.equal(deps("@todo/gates").includes(forbidden), false);
    }
  });
});
