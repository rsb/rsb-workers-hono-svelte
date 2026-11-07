import { type Page, expect, test } from "@playwright/test";
import { BASE, type Seeded, signIn } from "./signed-in.ts";
import { input, open } from "./todos.ts";

// Scenarios A.1 to A.6 and B.1 (`feature-accounts-shell.md` › A, B). A.7, the api
// failing, is the BFF's unit test of the page load. Each test signs in
// for itself, with Playwright's own `test`, so A.1 and A.2 can go without
// a session. The seed made "Dev Member" and "Dev Admin".

const topBar = (page: Page) => page.getByRole("banner");
const accountButton = (page: Page) => topBar(page).getByRole("button", { name: /^Account: / });
const menu = (page: Page) => page.locator("#account-menu");

/**
 * The top bar has no links but the product name's, which leads to `/`,
 * and "Sign in" (B): no "Todos", and no account button.
 */
const expectSignedOut = async (page: Page) => {
  await expect(page.getByText("Sign in to see your list. Your to-dos are kept with your account.")).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  await expect(page.getByRole("list")).toHaveCount(0);
  await expect(topBar(page).getByRole("link")).toHaveText(["Todo", "Sign in"]);
  await expect(accountButton(page)).toHaveCount(0);
};

const signInAs = (page: Page, who: Seeded) => signIn(page.context(), who);

test("A.1 given no session cookie, when I open /, then I see Sign in to see your list, no list, and no links in the top bar but Sign in", async ({
  page,
}) => {
  await open(page);

  await expectSignedOut(page);
});

test("A.2 given a session cookie that names no live session, when I open /, then I see the same, and the cookie is deleted", async ({
  page,
}) => {
  await page.context().addCookies([{ name: "sid", value: "names-no-session", url: BASE, httpOnly: true, sameSite: "Lax" }]);

  await open(page);

  await expectSignedOut(page);
  const cookies = await page.context().cookies(BASE);
  expect(cookies.map((cookie) => cookie.name)).not.toContain("sid");
});

test("A.3 given the member's session, when I open /, then the top bar shows Todos and the member's initials, and the page shows the list", async ({
  page,
}) => {
  await signInAs(page, "MEMBER_TOKEN");

  await open(page);

  const todos = topBar(page).getByRole("link", { name: "Todos", exact: true });
  await expect(todos).toBeVisible();
  await expect(todos).toHaveAttribute("aria-current", "page");
  await expect(accountButton(page)).toHaveAccessibleName("Account: Dev Member");
  await expect(accountButton(page)).toContainText("DM");
  await expect(input(page)).toBeVisible();
});

test("A.4 given the member's session, when I open the account menu, then it shows the member's name and email, and no Admin", async ({
  page,
}) => {
  await signInAs(page, "MEMBER_TOKEN");
  await open(page);

  await accountButton(page).click();

  await expect(menu(page)).toContainText("Dev Member");
  await expect(menu(page)).toContainText("member@example.test");
  await expect(menu(page).getByText("Admin", { exact: true })).toHaveCount(0);
  // Escape closes it, and focus goes back to the button.
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(accountButton(page)).toBeFocused();
});

test("A.5 given the admin's session, when I open the account menu, then it shows the admin's name, email and Admin, and there is no Users link", async ({
  page,
}) => {
  await signInAs(page, "ADMIN_TOKEN");
  await open(page);

  await accountButton(page).click();

  await expect(accountButton(page)).toContainText("DA");
  await expect(menu(page)).toContainText("Dev Admin");
  await expect(menu(page)).toContainText("admin@example.test");
  await expect(menu(page).getByText("Admin", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
});

test("A.6 given any session, when I open /nowhere, then I see This page doesn’t exist, in the frame", async ({ page }) => {
  await signInAs(page, "MEMBER_TOKEN");

  const response = await page.goto("/nowhere");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page doesn’t exist" })).toBeVisible();
  await expect(page.getByText("The address may be mistyped, or the page has moved.")).toBeVisible();
  // In the frame: the top bar, with the account, and "Todos" not current.
  await expect(accountButton(page)).toHaveAccessibleName("Account: Dev Member");
  await expect(topBar(page).getByRole("link", { name: "Todos", exact: true })).not.toHaveAttribute("aria-current");
  await expect(page.getByRole("link", { name: "Go to your to-dos" })).toHaveAttribute("href", "/");
});

test("B.1 given no session cookie, when I open /, then Sign in in the top bar and on the page each lead to the sign-in page, whose top bar has no Sign in", async ({
  page,
}) => {
  await open(page);
  await topBar(page).getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${BASE}/sign-in`);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(topBar(page).getByRole("link")).toHaveText(["Todo"]);

  await open(page);
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${BASE}/sign-in`);
});
