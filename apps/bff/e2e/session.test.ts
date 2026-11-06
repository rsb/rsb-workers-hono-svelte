import { type Page, expect, test } from "@playwright/test";
import { BASE, signIn } from "./signed-in.ts";
import { add, open, rowOf } from "./todos.ts";

// Stage 23: the BFF forwards the browser's session to the api (commit 7),
// and every todo operation requires a member (commit 8). This file signs
// in per test, with Playwright's own `test`, so its control can go without
// a cookie. Each test removes what it added.

const signInAsMember = (page: Page) => signIn(page.context(), "MEMBER_TOKEN");

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
  // arriving from elsewhere. Without one there is no session to ride on,
  // so the gate lets the post go on (L38), and it is anonymous: adding
  // requires a member, and the runner refuses it, 401 and not the gate's
  // 403 (`access.md`).
  const response = await crossSitePost(page, "no cookie, from elsewhere");

  expect(response.status()).toBe(401);
  await signInAsMember(page);
  await open(page);
  await expect(rowOf(page, "no cookie, from elsewhere")).toHaveCount(0);
});
