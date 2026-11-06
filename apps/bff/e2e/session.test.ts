import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { add, open, rowOf } from "./todos.ts";

// Stage 23, commit 7: the BFF forwards the browser's session to the api.
// `dev:e2e` seeds a member session whose raw token is in apps/api/.dev.tokens
// (apps/api/scripts/seed-dev.ts); the browser carries it as the `sid` cookie,
// local dev's name for `__Host-sid`. No dev-only route and nothing in the BFF
// knows the seed: the cookie goes in through Playwright, as a browser holds it.
// The todos are not yet the actor's own (commit 8), so each test removes
// what it added and the files after it see the store as it was.

const BASE = "http://localhost:5173";

/** The member's raw session token, as the seed wrote it. */
const memberToken = () => {
  const path = join(import.meta.dirname, "..", "..", "api", ".dev.tokens");
  const line = readFileSync(path, "utf8")
    .split("\n")
    .find((entry) => entry.startsWith("MEMBER_TOKEN="));
  if (line === undefined) {
    throw new Error(`no MEMBER_TOKEN in ${path}: dev:e2e seeds it`);
  }
  return line.slice("MEMBER_TOKEN=".length).trim();
};

const signInAsMember = async (page: Page) => {
  await page.context().addCookies([{ name: "sid", value: memberToken(), url: BASE, httpOnly: true, sameSite: "Lax" }]);
};

/** Removes the todo with this title through the page. */
const remove = async (page: Page, title: string) => {
  await open(page);
  const row = rowOf(page, title);
  await row.hover();
  await row.getByRole("button", { name: /^Remove ‘/ }).click();
  await expect(row).toHaveCount(0);
};

/**
 * Posts the add form as another site's page would: a form body, which needs
 * no preflight, and `Sec-Fetch-Site: cross-site`, which the channel gate
 * reads first. A browser would also send that site's `Origin`, but under
 * local dev the binding's proxy refuses a foreign `Origin` itself, as a
 * plain-text 403 that never reaches the api; the gate's `Origin` fallback
 * is held by its unit tests instead.
 */
const crossSitePost = (page: Page, title: string) =>
  page.request.post(`${BASE}/?/add`, {
    form: { title },
    headers: { "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "navigate" },
    maxRedirects: 0,
  });

test("given the member's session cookie, the page loads and the add form posts through the channel gate", async ({
  page,
}) => {
  await signInAsMember(page);
  await open(page);

  await add(page, "with a session");
  await page.reload();
  await expect(rowOf(page, "with a session")).toBeVisible();

  await remove(page, "with a session");
});

test("given the member's session cookie, a cross-site form post is refused and adds nothing", async ({ page }) => {
  await signInAsMember(page);

  const response = await crossSitePost(page, "from elsewhere");

  // The api's channel gate refuses it as forbidden; the BFF answers 403.
  expect(response.status()).toBe(403);
  await open(page);
  await expect(rowOf(page, "from elsewhere")).toHaveCount(0);
});

test("without a session cookie, the same cross-site post is not the channel gate's to refuse", async ({ page }) => {
  // The control for the refusal above: what the gate refused was the cookie
  // arriving from elsewhere, so it was forwarded. Without one there is no
  // session to ride on, and the post goes on (L38).
  const response = await crossSitePost(page, "no cookie, from elsewhere");

  expect(response.status()).toBe(200);
  await open(page);
  await expect(rowOf(page, "no cookie, from elsewhere")).toBeVisible();

  await remove(page, "no cookie, from elsewhere");
});
