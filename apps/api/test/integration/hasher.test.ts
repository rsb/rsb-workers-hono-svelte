import argon2Wasm from "@phi-ag/argon2/argon2.wasm";
import { ARGON2_PARAMS, CURRENT_PEPPER_ID, DUMMY_PASSWORD_HASH } from "@todo/business/auth/credential.ts";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { argon2FromWasm, createHasher } from "../../src/auth/hasher.ts";
import { readConfig } from "../../src/config.ts";

// The hasher in workerd, as construct builds it: the .wasm imported as a
// module, the pepper from the config the Worker reads (here the one
// vitest.integration.config.ts binds). The unit tier tests the same code on
// the package's Node entry, which the dev seed hashes with. The proof that
// the two agree is the e2e sign-in against a seeded user; the fixed hash
// below checks the format here first.

const config = readConfig(env);
if (!config.ok) {
  throw new Error("the integration config does not read");
}

const hasher = createHasher({ argon2: argon2FromWasm(argon2Wasm), peppers: config.value.peppers });

const PASSWORD = "correct horse battery staple";

describe("the hasher in workerd", () => {
  it("hashes at the constants' parameters, and checks the password it hashed and no other", async () => {
    const hashed = await hasher.hash(PASSWORD);
    if (!hashed.ok) {
      throw hashed.error;
    }

    expect(hashed.value.secret.startsWith(`$argon2id$v=19$m=${ARGON2_PARAMS.memoryCost},t=${ARGON2_PARAMS.timeCost},p=${ARGON2_PARAMS.parallelism}$`)).toBe(true);
    expect(hashed.value.pepperId).toBe(CURRENT_PEPPER_ID);
    expect(hasher.needsRehash(hashed.value)).toBe(false);
    expect(await hasher.verify(PASSWORD, hashed.value)).toEqual({ ok: true, value: true });
    expect(await hasher.verify("wrong horse battery staple", hashed.value)).toEqual({ ok: true, value: false });
  });

  it("checks a PHC string the Node entry made, given the same pepper", async () => {
    // Made once by `createHasher` on @phi-ag/argon2/node, from PASSWORD
    // under the integration config's PEPPER_1.
    const fromNode = { secret: NODE_MADE_SECRET, pepperId: CURRENT_PEPPER_ID };

    expect(await hasher.verify(PASSWORD, fromNode)).toEqual({ ok: true, value: true });
    expect(await hasher.verify("wrong horse battery staple", fromNode)).toEqual({ ok: true, value: false });
  });

  // Q4 (handoff 24): the cost of one check, measured, not asserted. Wall
  // time in local workerd, not production CPU, which the platform meters
  // out of sight. Best of three, so a cold start or a busy machine does not
  // stand in for the hash. Printed for the run's log; the budget cites it.
  it("measures one check against the dummy hash, best of 3", async () => {
    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const checked = await hasher.verify(PASSWORD, DUMMY_PASSWORD_HASH);
      runs.push(performance.now() - start);
      expect(checked).toEqual({ ok: true, value: false });
    }
    console.log(
      `argon2id verify, m=${ARGON2_PARAMS.memoryCost} t=${ARGON2_PARAMS.timeCost} p=${ARGON2_PARAMS.parallelism}: best ${Math.min(...runs).toFixed(0)} ms of ${runs.map((run) => run.toFixed(0)).join(", ")} (wall time, local workerd, not production CPU)`,
    );
  });
});

/** PASSWORD's hash, as the Node entry made it under the integration pepper. */
const NODE_MADE_SECRET = "$argon2id$v=19$m=19456,t=2,p=1$HeHjvmNgzZq67IPtZ+SCbA$yj3ibLIulIjlqb0SAChrYvpJQiPa85hyo6IBGGu7QeE";
