import { type Browser, devices, expect, test } from "@playwright/test";
import { BASE, SIGNED_OUT_NOTICE_WORDS, SIGNED_OUT_WORDS, signIn, signInThroughPage } from "../signed-in.ts";
import { input, open } from "../todos.ts";

// Scenario B.2 (`feature-accounts-profile.md` › B). Sign out everywhere
// ends every session of the member's, the seeded one the other files use
// among them, so this file runs in its own project, after every other
// (playwright.config.ts).

const phone = async (browser: Browser) => {
  const context = await browser.newContext({ userAgent: devices["iPhone 13"].userAgent });
  return context.newPage();
};

test("B.2 given the member signed in on two browsers, when I sign out everywhere in one, then the other is signed out on its next page load, and so is every other session of the member's", async ({
  page,
  browser,
}) => {
  const other = await phone(browser);
  await signInThroughPage(other);
  await signInThroughPage(page);
  await open(page, "/profile");

  const signingOut = page.waitForResponse((response) => response.url().startsWith(`${BASE}/profile?/everywhere`) && response.request().method() === "POST");
  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  const response = await signingOut;

  expect(response.status()).toBe(303);
  expect((await response.allHeaders())["clear-site-data"]).toBe('"cache"');
  await expect(page).toHaveURL(`${BASE}/?signed-out`);
  await expect(page.getByRole("status")).toHaveText(SIGNED_OUT_NOTICE_WORDS);
  expect((await page.context().cookies(BASE)).find((cookie) => cookie.name === "sid")).toBeUndefined();

  // The other browser learns on its next request, and deletes the cookie.
  await open(other, "/");
  await expect(other.getByText(SIGNED_OUT_WORDS)).toBeVisible();
  await expect(input(other)).toHaveCount(0);
  expect((await other.context().cookies(BASE)).find((cookie) => cookie.name === "sid")).toBeUndefined();

  // The seed's session too: every session of the member's ended.
  const seeded = await browser.newContext();
  await signIn(seeded, "MEMBER_TOKEN");
  const third = await seeded.newPage();
  await open(third, "/");
  await expect(third.getByText(SIGNED_OUT_WORDS)).toBeVisible();

  await other.context().close();
  await seeded.close();
});
