import { type Browser, type Page, devices, expect, test } from "@playwright/test";
import { signInThroughPage } from "./signed-in.ts";

// Scenario B.1 (`feature-accounts-profile.md` › B). Playwright's own
// `test`: each browser signs in through the page, so this device and the
// other are sessions of the test's own. Earlier files leave sessions of
// the member's live, so the test looks for its two rows, not a count.

/** The other device: a phone, by its `User-Agent`, which labels its session. */
const phone = async (browser: Browser) => {
  const context = await browser.newContext({ userAgent: devices["iPhone 13"].userAgent });
  return context.newPage();
};

/** The Sessions section's row whose label is this. */
const rowOf = (page: Page, label: string) => page.getByRole("region", { name: "Sessions" }).getByRole("listitem").filter({ hasText: label });

test("B.1 given the member signed in on this browser and on a phone, when I open Profile from the account menu, then Sessions lists this device and the other", async ({
  page,
  browser,
}) => {
  const other = await phone(browser);
  await signInThroughPage(other);
  await signInThroughPage(page);

  await page.getByRole("button", { name: "Account: Dev Member" }).click();
  await page.getByRole("link", { name: "Profile" }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
  await expect(page.getByText(/^Signed in on \d+ devices\.$/)).toBeVisible();
  // The project's browser says Chrome on Windows. Miniflare gives every
  // request a stand-in `request.cf`, so a city crosses the binding to the
  // api; which one is miniflare's, and this does not settle what
  // production's `request.cf` carries.
  const here = rowOf(page, "This device");
  await expect(here).toHaveCount(1);
  await expect(here.locator(".label")).toHaveText("Chrome on Windows This device");
  await expect(here.locator(".detail")).toHaveText(/^[^·]+ · Active now$/);
  const there = rowOf(page, "Safari on iOS").first();
  await expect(there).not.toContainText("This device");
  await expect(there.locator(".detail")).toHaveText(/ · Active in the last day$/);
  await expect(page.getByRole("link", { name: "Profile" })).toHaveCount(0);

  await other.context().close();
});
