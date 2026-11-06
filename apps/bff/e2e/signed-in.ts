import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, test as base } from "@playwright/test";

// Every todo operation requires a member (`prd/todo/access.md`), so a page
// that shows the list is a signed-in person's. `dev:e2e` seeds a member and
// an admin, each with a cookie session whose raw token is in
// apps/api/.dev.tokens (apps/api/scripts/seed-dev.ts). The cookie goes in
// through Playwright, as a browser holds it: no dev-only route, and nothing
// in the BFF knows the seed. Its name is `sid`, local dev's `__Host-sid`.

export const BASE = "http://localhost:5173";

/** Who the seed made, by their key in `.dev.tokens`. */
export type Seeded = "MEMBER_TOKEN" | "ADMIN_TOKEN";

/** A seeded person's raw session token, as the seed wrote it. */
const tokenOf = (key: Seeded) => {
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
  await context.addCookies([{ name: "sid", value: tokenOf(key), url: BASE, httpOnly: true, sameSite: "Lax" }]);
};

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
