import { type Page, expect, test } from "@playwright/test";
import { BASE, passwordOf } from "./signed-in.ts";
import { input, open } from "./todos.ts";

// Scenarios B.2 and B.3 (`feature-accounts-shell.md` › B). Playwright's
// own `test`: each signs in through the page first, so it ends a session
// of its own and never the seeded one the other files use.

const NOTICE = "You’re signed out on this device.";
const SIGNED_OUT = "Sign in to see your list. Your to-dos are kept with your account.";

const signInAsMember = async (page: Page) => {
  await open(page, "/sign-in");
  await page.getByLabel("Email").fill("member@example.test");
  await page.getByLabel("Password").fill(passwordOf("MEMBER_PASSWORD"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(input(page)).toBeVisible();
};

const signOutFromMenu = async (page: Page) => {
  await page.getByRole("button", { name: "Account: Dev Member" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
};

const sessionCookie = async (page: Page) => (await page.context().cookies(BASE)).find((cookie) => cookie.name === "sid");

test("B.2 given the member signed in, when I sign out from the account menu, then I see the notice and no list, and Back shows no list", async ({
  page,
}) => {
  await signInAsMember(page);
  // The list was drawn for a signed-in person, so no cache keeps it.
  const list = await page.request.get(`${BASE}/`);
  expect(list.headers()["cache-control"]).toBe("no-store");

  const signingOut = page.waitForResponse((response) => response.url() === `${BASE}/sign-out` && response.request().method() === "POST");
  await signOutFromMenu(page);
  const response = await signingOut;

  expect(response.status()).toBe(303);
  // `headers()` leaves out the security-related ones.
  expect((await response.allHeaders())["clear-site-data"]).toBe('"cache"');
  await expect(page).toHaveURL(`${BASE}/?signed-out`);
  await expect(page.getByRole("status")).toHaveText(NOTICE);
  await expect(page.getByText(SIGNED_OUT)).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  expect(await sessionCookie(page)).toBeUndefined();

  await page.goBack();

  await expect(page).toHaveURL(`${BASE}/`);
  await expect(page.getByText(SIGNED_OUT)).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Account: Dev Member" })).toHaveCount(0);
});

test("B.3 given a session signed out, when its cookie is presented again, then it signs nobody in, and is deleted", async ({ page }) => {
  await signInAsMember(page);
  const kept = await sessionCookie(page);
  expect(kept).toBeDefined();

  await signOutFromMenu(page);
  await expect(page.getByRole("status")).toHaveText(NOTICE);
  // As a thief who copied the cookie before sign-out would hold it.
  await page.context().addCookies([{ name: "sid", value: kept?.value ?? "", url: BASE, httpOnly: true, sameSite: "Lax" }]);
  await open(page, "/");

  await expect(page.getByText(SIGNED_OUT)).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  expect(await sessionCookie(page)).toBeUndefined();
});

test("B.2 sign-out is a POST: opening /sign-out signs nobody out and goes to the list", async ({ page }) => {
  await signInAsMember(page);

  await open(page, "/sign-out");

  await expect(page).toHaveURL(`${BASE}/`);
  await expect(input(page)).toBeVisible();
  expect(await sessionCookie(page)).toBeDefined();
});
