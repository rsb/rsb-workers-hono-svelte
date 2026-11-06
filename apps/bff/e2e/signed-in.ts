import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, test as base } from "@playwright/test";

// Every todo operation requires a member (`prd/todo/access.md`), so a page
// that shows the list is a signed-in person's. `dev:e2e` seeds a member and
// an admin, each with a cookie session whose raw token is in
// apps/api/.dev.tokens (apps/api/scripts/seed-dev.ts), beside each one's
// password. The cookie goes in
// through Playwright, as a browser holds it: no dev-only route, and nothing
// in the BFF knows the seed. Its name is `sid`, local dev's `__Host-sid`.

export const BASE = "http://localhost:5173";

/** Who the seed made, by the key of their session token in `.dev.tokens`. */
export type Seeded = "MEMBER_TOKEN" | "ADMIN_TOKEN";

/** Who the seed made, by the key of their password in `.dev.tokens`. */
export type SeededPassword = "MEMBER_PASSWORD" | "ADMIN_PASSWORD";

/** A value the seed wrote to `.dev.tokens`: a raw session token or a raw password. */
const seeded = (key: Seeded | SeededPassword) => {
  const path = join(import.meta.dirname, "..", "..", "api", ".dev.tokens");
  const line = readFileSync(path, "utf8")
    .split("\n")
    .find((entry) => entry.startsWith(`${key}=`));
  if (line === undefined) {
    throw new Error(`no ${key} in ${path}: dev:e2e seeds it`);
  }
  return line.slice(key.length + 1).trim();
};

/** Gives the browser context the seeded person's session cookie. */
export const signIn = async (context: BrowserContext, key: Seeded) => {
  await context.addCookies([{ name: "sid", value: seeded(key), url: BASE, httpOnly: true, sameSite: "Lax" }]);
};

/**
 * A seeded person's password, as the seed wrote it, for typing into the
 * sign-in page. The seed sets it on every run (seed-dev.ts).
 */
export const passwordOf = (key: SeededPassword) => seeded(key);

/**
 * Playwright's `test`, with every page signed in as the member. A file
 * whose tests need no session, or another person's, uses Playwright's own.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await signIn(context, "MEMBER_TOKEN");
    await use(context);
  },
});
