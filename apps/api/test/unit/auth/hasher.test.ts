import initialize from "@phi-ag/argon2/node";
import { ARGON2_PARAMS, CURRENT_PEPPER_ID, DUMMY_PASSWORD_HASH } from "@todo/business/auth/credential.ts";
import { beforeAll, describe, expect, it } from "vitest";
import { createHasher } from "../../../src/auth/hasher.ts";

// The hasher (L48) on the package's Node entry: the dev seed's Argon2. The
// Worker's, from the .wasm imported as a module, is the integration tier's
// (test/integration/hasher.test.ts). Real Argon2id at the real parameters,
// so each hash or check here costs tens of milliseconds.

/** Two peppers of the length the dev seed writes. Not secrets: they key only these tests' hashes. */
const PEPPERS = { 1: "unit-pepper-one-not-a-secret-0000000000001", 2: "unit-pepper-two-not-a-secret-0000000000002" };

const PASSWORD = "correct horse battery staple";

let argon2: Awaited<ReturnType<typeof initialize>>;
beforeAll(async () => {
  argon2 = await initialize();
});

const hasher = (peppers: Record<number, string> = PEPPERS) => createHasher({ argon2: () => argon2, peppers });

const CURRENT_HEAD = `$argon2id$v=19$m=${ARGON2_PARAMS.memoryCost},t=${ARGON2_PARAMS.timeCost},p=${ARGON2_PARAMS.parallelism}$`;

describe("hash", () => {
  it("writes an Argon2id PHC string at the constants' parameters, under the current pepper", async () => {
    const hashed = await hasher().hash(PASSWORD);

    expect(hashed.ok).toBe(true);
    if (hashed.ok) {
      // The parameters are what set the cost: m=19456 KiB, t=2, p=1.
      expect(hashed.value.secret.startsWith(CURRENT_HEAD)).toBe(true);
      expect(hashed.value.secret).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
      expect(hashed.value.pepperId).toBe(CURRENT_PEPPER_ID);
    }
  });

  it("salts each hash, so one password hashes two ways", async () => {
    const first = await hasher().hash(PASSWORD);
    const second = await hasher().hash(PASSWORD);

    expect(first.ok && second.ok && first.value.secret !== second.value.secret).toBe(true);
  });

  it("is a server fault when the current pepper is not configured", async () => {
    const hashed = await hasher({ 2: PEPPERS[2] }).hash(PASSWORD);

    expect(hashed.ok).toBe(false);
    expect(!hashed.ok && hashed.error.kind).toBe("server");
    expect(!hashed.ok && hashed.error.message).toBe("no pepper is configured for pepper id 1");
  });
});

describe("verify", () => {
  it("matches the password a hash was made from, and no other", async () => {
    const hashed = await hasher().hash(PASSWORD);
    if (!hashed.ok) {
      throw hashed.error;
    }

    expect(await hasher().verify(PASSWORD, hashed.value)).toEqual({ ok: true, value: true });
    expect(await hasher().verify(`${PASSWORD} `, hashed.value)).toEqual({ ok: true, value: false });
    expect(await hasher().verify("", hashed.value)).toEqual({ ok: true, value: false });
  });

  it("normalizes to NFKC first, so one password typed two ways is one password", async () => {
    // "é" precomposed and as e with a combining accent; "ﬁ" as a ligature
    // and as two letters. Each pair is one password after NFKC.
    const hashed = await hasher().hash("café ﬁve");
    if (!hashed.ok) {
      throw hashed.error;
    }

    expect(await hasher().verify("café five", hashed.value)).toEqual({ ok: true, value: true });
  });

  it("keys the input with the pepper, so the same PHC string under another pepper does not match", async () => {
    const hashed = await hasher().hash(PASSWORD);
    if (!hashed.ok) {
      throw hashed.error;
    }

    const swapped = createHasher({ argon2: () => argon2, peppers: { 1: PEPPERS[2] } });
    expect(await swapped.verify(PASSWORD, hashed.value)).toEqual({ ok: true, value: false });
  });

  it("checks a hash under an older pepper with that pepper", async () => {
    const old = await createHasher({ argon2: () => argon2, peppers: { 1: PEPPERS[2] } }).hash(PASSWORD);
    if (!old.ok) {
      throw old.error;
    }
    // As if PEPPER_2 had been the pepper when the hash was made.
    const stored = { secret: old.value.secret, pepperId: 2 };

    expect(await hasher().verify(PASSWORD, stored)).toEqual({ ok: true, value: true });
  });

  it("is a server fault for a pepper id with no configured secret", async () => {
    const checked = await hasher().verify(PASSWORD, { secret: DUMMY_PASSWORD_HASH.secret, pepperId: 9 });

    expect(!checked.ok && checked.error.kind).toBe("server");
    expect(!checked.ok && checked.error.message).toBe("no pepper is configured for pepper id 9");
  });

  it("is a server fault for a stored hash that is not an Argon2id PHC string", async () => {
    for (const secret of ["", "plain", "$argon2i$v=19$m=19456,t=2,p=1$K06mhh3om0h4Gzr4aVVH3w$nYredE6DewNRu/oC/Lh/M56JNYaZAQm0wfJ1vlMdBKo", "$argon2id$v=19$m=19456,t=2,p=1$broken"]) {
      const checked = await hasher().verify(PASSWORD, { secret, pepperId: 1 });
      expect(!checked.ok && checked.error.kind, secret).toBe("server");
    }
  });

  it("never matches the dummy hash sign-in checks for an unknown email", async () => {
    expect(await hasher().verify(PASSWORD, DUMMY_PASSWORD_HASH)).toEqual({ ok: true, value: false });
    expect(await hasher().verify("", DUMMY_PASSWORD_HASH)).toEqual({ ok: true, value: false });
  });
});

describe("needsRehash", () => {
  it("is false for a hash at the current parameters and pepper", async () => {
    const hashed = await hasher().hash(PASSWORD);

    expect(hashed.ok && hasher().needsRehash(hashed.value)).toBe(false);
  });

  it("is true under an older pepper, or at other parameters or another algorithm", () => {
    const tail = "$K06mhh3om0h4Gzr4aVVH3w$nYredE6DewNRu/oC/Lh/M56JNYaZAQm0wfJ1vlMdBKo";
    expect(hasher().needsRehash({ secret: `${CURRENT_HEAD.slice(0, -1)}${tail}`, pepperId: 2 })).toBe(true);
    for (const head of ["$argon2id$v=19$m=65536,t=3,p=4", "$argon2id$v=19$m=19456,t=1,p=1", "$argon2id$v=19$m=19456,t=2,p=2", "$argon2id$v=16$m=19456,t=2,p=1", "$argon2i$v=19$m=19456,t=2,p=1"]) {
      expect(hasher().needsRehash({ secret: `${head}${tail}`, pepperId: CURRENT_PEPPER_ID }), head).toBe(true);
    }
  });

  it("is false for the dummy hash, so a change to ARGON2_PARAMS must replace it", () => {
    // The unknown-email check costs what a real one does only while the
    // dummy is at the current parameters (threats row 7).
    expect(hasher().needsRehash(DUMMY_PASSWORD_HASH)).toBe(false);
  });
});

describe("the Argon2 instance", () => {
  it("is made on the first hash or check, and once", async () => {
    let made = 0;
    const lazy = createHasher({
      argon2: () => {
        made += 1;
        return argon2;
      },
      peppers: PEPPERS,
    });
    expect(made).toBe(0);

    const hashed = await lazy.hash(PASSWORD);
    if (!hashed.ok) {
      throw hashed.error;
    }
    await lazy.verify(PASSWORD, hashed.value);
    lazy.needsRehash(hashed.value);

    expect(made).toBe(1);
  });
});
