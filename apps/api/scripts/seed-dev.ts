// The dev seed (handoff 23, Q1): one member and one admin, each verified,
// with a password and a live cookie session, written through the identity
// store's own methods (`data/identity.md`: `users.create`,
// `users.find_by_email`, `users.mark_verified`, `credentials.set`,
// `identity.sign_in`), so the seed breaks when the store does. It reaches
// the local IDENTITY_DB through wrangler's `getPlatformProxy`; there is no
// dev-only route, and nothing in the api knows the seed exists.
//
// The raw tokens and passwords live in `.dev.tokens` (gitignored,
// rl-0012), written once when missing and read on every later run, so they
// stay the same across the fresh database e2e makes each run. They are not
// in `.dev.vars`: wrangler loads every `.dev.vars` key into the Worker's
// env and into `wrangler types`, so a token there would sit in the api's
// env and make `pnpm check` depend on whether the file exists. `.dev.vars`
// holds local dev's config: `SESSION_COOKIE=sid`, and `PEPPER_1`, the
// secret password hashes are keyed with (L48), 32 random bytes. Each is
// written once when missing. A secret belongs there: wrangler.jsonc names
// it in `secrets.required`, so `wrangler types` reads that list, not the
// file.
//
// Each run hashes both passwords again, under the pepper `.dev.vars` holds
// now, and sets them (`credentials.set` overwrites). The pepper is read
// first, so a deleted `PEPPER_1` is written fresh before any hash, and the
// same run rewrites both credentials under it: a regenerated pepper heals
// on the next seed, and never leaves a stored hash unreadable for longer.
// The hash is the Worker's own code path (`createHasher`), on the Argon2
// package's Node entry.
//
// Usage, from apps/api, after the identity migrations:
//   node scripts/seed-dev.ts                 the database `pnpm dev` uses
//   node scripts/seed-dev.ts .wrangler/e2e   the one `dev:e2e` persists to

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import initialize from "@phi-ag/argon2/node";
import type { Role } from "@todo/business/auth/actor.ts";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "@todo/business/auth/session.ts";
import { createIdentityStore } from "@todo/data-d1/identity/store.ts";
import { getPlatformProxy } from "wrangler";
import { createHasher } from "../src/auth/hasher.ts";
import { sha256Hex } from "../src/gates/digest.ts";

/** The two people the seed makes, and the keys their token and password have in `.dev.tokens`. */
const people: { key: string; passwordKey: string; email: string; name: string; role: Role }[] = [
  { key: "MEMBER_TOKEN", passwordKey: "MEMBER_PASSWORD", email: "member@example.test", name: "Dev Member", role: "member" },
  { key: "ADMIN_TOKEN", passwordKey: "ADMIN_PASSWORD", email: "admin@example.test", name: "Dev Admin", role: "admin" },
];

/** Under `http://localhost` a browser refuses a `__Host-` cookie, so local dev names it `sid` (`src/config.ts`). */
const DEV_COOKIE = "sid";

const apiDir = join(import.meta.dirname, "..");
const devVarsPath = join(apiDir, ".dev.vars");
const tokensPath = join(apiDir, ".dev.tokens");

/** A `KEY=value` file's entries. Blank lines and `#` comments are skipped. */
const readEntries = (path: string): Map<string, string> => {
  const entries = new Map<string, string>();
  if (!existsSync(path)) {
    return entries;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      entries.set(match[1], match[2].replace(/^"(.*)"$/, "$1"));
    }
  }
  return entries;
};

/**
 * A key's value, appending `fresh()` to the file only when the key is
 * missing: an entry already there is never rewritten.
 */
const ensureEntry = (path: string, key: string, fresh: () => string): string => {
  const existing = readEntries(path).get(key);
  if (existing !== undefined) {
    return existing;
  }
  const value = fresh();
  const before = existsSync(path) ? readFileSync(path, "utf8") : "";
  const separator = before === "" || before.endsWith("\n") ? "" : "\n";
  writeFileSync(path, `${before}${separator}${key}=${value}\n`);
  console.log(`wrote ${key} to ${path}`);
  return value;
};

/** 32 random bytes, base64url without padding: the 43 characters `TOKEN_PATTERN` takes. */
const newToken = () => randomBytes(32).toString("base64url");

/** 16 random bytes, base64url: 22 characters, typed into the sign-in page by hand. */
const newPassword = () => randomBytes(16).toString("base64url");

const persistTo = process.argv[2];
const cookieName = ensureEntry(devVarsPath, "SESSION_COOKIE", () => DEV_COOKIE);
// Never rewritten here. Deleted by hand, it is written fresh, and the
// credentials below are set again under it.
const pepper = ensureEntry(devVarsPath, "PEPPER_1", () => randomBytes(32).toString("base64url"));
const argon2 = await initialize();
// PEPPER_1 is pepper id 1, as `readConfig` reads it.
const hasher = createHasher({ argon2: () => argon2, peppers: { 1: pepper } });

const proxy = await getPlatformProxy<{ IDENTITY_DB: D1Database }>({
  configPath: join(apiDir, "wrangler.jsonc"),
  // wrangler dev's `--persist-to <dir>` keeps its state under `<dir>/v3`.
  persist: persistTo === undefined ? true : { path: join(apiDir, persistTo, "v3") },
});

try {
  const store = createIdentityStore(proxy.env.IDENTITY_DB);
  const now = Date.now();

  for (const person of people) {
    const created = await store.createUser({
      id: crypto.randomUUID(),
      email: person.email,
      name: person.name,
      role: person.role,
      createdAt: now,
    });
    if (!created.ok) {
      throw new Error(`users.create failed for ${person.email}: ${created.error.message}`);
    }

    // Created or not, the stored row's id is the one to start a session for.
    const found = await store.findUserByEmail(person.email);
    if (!found.ok) {
      throw new Error(`users.find_by_email failed for ${person.email}: ${found.error.message}`);
    }
    if (found.value === null) {
      throw new Error(`users.find_by_email found no ${person.email} after users.create`);
    }

    const userId = found.value.id;
    const verified = await store.markVerified(userId, now);
    if (!verified.ok) {
      throw new Error(`users.mark_verified failed for ${person.email}: ${verified.error.message}`);
    }

    // Every run, so the stored hash is always under the pepper .dev.vars holds.
    const password = ensureEntry(tokensPath, person.passwordKey, newPassword);
    const hashed = await hasher.hash(password);
    if (!hashed.ok) {
      throw new Error(`hashing the password failed for ${person.email}: ${hashed.error.message}`);
    }
    const set = await store.setCredential({
      userId,
      kind: "password",
      secret: hashed.value.secret,
      pepperId: hashed.value.pepperId,
      now,
    });
    if (!set.ok) {
      throw new Error(`credentials.set failed for ${person.email}: ${set.error.message}`);
    }

    const token = ensureEntry(tokensPath, person.key, newToken);
    // Sign-in's own write, with no presented session and no rehash: the
    // new session alone.
    const started = await store.recordSignIn({
      session: {
        id: crypto.randomUUID(),
        tokenHash: await sha256Hex(token),
        userId,
        channel: "cookie",
        createdAt: now,
        idleUntil: now + SESSION_IDLE_MS,
        expiresAt: now + SESSION_ABSOLUTE_MS,
        label: null,
        city: null,
      },
    });
    if (!started.ok) {
      throw new Error(`identity.sign_in failed for ${person.email}: ${started.error.message}`);
    }

    const user = created.value ? "created" : "already there";
    const session = started.value.started ? "session started" : "session already there";
    const verification = verified.value ? "verified" : "already verified";
    console.log(`${person.role} ${person.email}: ${user}, ${verification}, password set, ${session}`);
    console.log(`  password: the ${person.passwordKey} line in .dev.tokens`);
    // For manual `pnpm dev`: paste into the console at http://localhost:5173.
    console.log(`  document.cookie = "${cookieName}=${token}; path=/; SameSite=Lax"`);
  }

  console.log(
    "A session already there lapses a day after its last use. To start a fresh one, delete its line from .dev.tokens and run the seed again.",
  );
} finally {
  await proxy.dispose();
}
