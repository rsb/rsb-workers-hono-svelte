// The config check, run as `pnpm check:config` runs it, from the repo root:
// the committed vars with the overlay the dev seed writes read as the api's
// config, and each broken set is refused, naming the variable.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { devVars, parseJsonc, wranglerVars } from "./read-vars.ts";

const WRANGLER = "apps/api/wrangler.jsonc";

const run = (args: string[]) => spawnSync(process.execPath, ["tooling/config-check/check.ts", ...args], { encoding: "utf8" });

const scratch = mkdtempSync(join(tmpdir(), "config-check-"));

/** A directory holding the files given, by name; returns each one's path. */
const files = (name: string, contents: Record<string, string>) => {
  const dir = join(scratch, name);
  mkdirSync(dir, { recursive: true });
  const paths: Record<string, string> = {};
  for (const [file, text] of Object.entries(contents)) {
    paths[file] = join(dir, file);
    writeFileSync(paths[file], text);
  }
  return { dir, paths };
};

/** The seed's overlay, as apps/api/scripts/seed-dev.ts writes it, with a pepper that is not a secret. */
const SEEDED = `SESSION_COOKIE=sid\nPEPPER_1=${"p".repeat(43)}\n`;

describe("config check", () => {
  it("passes the committed vars with the seed's overlay: local dev's config", () => {
    const { paths } = files("seeded", { ".dev.vars": SEEDED });
    const result = run([WRANGLER, paths[".dev.vars"] as string]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /read as the api's config/);
  });

  it("refuses an overlay without the pepper: a secret is never in the committed vars", () => {
    const { paths } = files("no-pepper", { ".dev.vars": "SESSION_COOKIE=sid\n" });
    const result = run([WRANGLER, paths[".dev.vars"] as string]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^ {2}PEPPER_1 is not set$/m);
  });

  it("refuses the committed vars alone: a __Host- cookie under an http BFF", () => {
    // Not a deployed config: the BFF_ORIGIN is local dev's. A deploy brings
    // its own vars, and their check, with the deploy workflow.
    const result = run([WRANGLER, join(scratch, "absent", ".dev.vars")]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /there is no .*\.dev\.vars/);
    assert.match(result.stderr, /SESSION_COOKIE is __Host-sid, which a browser accepts only over https/);
  });

  it("refuses an overlay that breaks the config, naming each variable", () => {
    const { paths } = files("broken", { ".dev.vars": 'BFF_ORIGIN="http://todo.example"\nSESSION_COOKIE=s id\n' });
    const result = run([WRANGLER, paths[".dev.vars"] as string]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^ {2}BFF_ORIGIN is "http:\/\/todo\.example": an origin is https/m);
    assert.match(result.stderr, /^ {2}SESSION_COOKIE is "s id", which is not a cookie name/m);
  });

  it("refuses a wrangler.jsonc that does not set a variable, or sets one that is not a string", () => {
    const { paths } = files("unset", {
      "wrangler.jsonc": '{\n  // no cookie\n  "vars": { "BFF_ORIGIN": 5173, },\n}\n',
    });
    const result = run([paths["wrangler.jsonc"] as string, join(scratch, "unset", ".dev.vars")]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /BFF_ORIGIN is not a string/);
    assert.match(result.stderr, /SESSION_COOKIE is not set/);
  });

  it("answers a usage error with 2", () => {
    assert.equal(run([WRANGLER]).status, 2);
  });
});

describe("reading vars", () => {
  it("reads wrangler.jsonc's comments, trailing commas and a // inside a string", () => {
    assert.deepEqual(parseJsonc('{ /* a */ "url": "https://x.example", // b\n "n": [1, 2,], }'), { url: "https://x.example", n: [1, 2] });
  });

  it("reads the committed vars as the Worker's env holds them", () => {
    assert.deepEqual(wranglerVars(readFileSync(WRANGLER, "utf8")), {
      BFF_ORIGIN: "http://localhost:5173",
      SESSION_COOKIE: "__Host-sid",
    });
    assert.deepEqual(wranglerVars('{ "vars": { "LIMIT": 5 } }'), { LIMIT: 5 });
    assert.deepEqual(wranglerVars("{}"), {});
  });

  it("reads a .dev.vars: KEY=value lines, quotes removed, comments and blanks skipped", () => {
    assert.deepEqual(devVars('# local\n\nA=1\n B = "two words" \nnot a line\n'), { A: "1", B: "two words" });
  });
});
