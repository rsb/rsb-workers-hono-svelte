import { type Page, expect, test } from "@playwright/test";

// PRD scenarios 5.1 and 5.2. The API's store is shared by the whole run
// (D19), and earlier files leave todos in it. Each test first removes every
// todo through the page, so its "given" is exactly true.

const input = (page: Page) => page.getByRole("textbox", { name: "New to-do" });
const items = (page: Page) => page.getByRole("listitem");

/** The row of the todo with this title, found by its checkbox. */
const rowOf = (page: Page, title: string) =>
  items(page).filter({ has: page.getByRole("checkbox", { name: title, exact: true }) });

/** The remove button of the todo with this title. */
const removeOf = (page: Page, title: string) => page.getByRole("button", { name: `Remove ‘${title}’`, exact: true });

/** Opens the page and waits until the client has loaded. */
const open = async (page: Page) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
};

/** Adds a todo and waits until its row shows. */
const add = async (page: Page, title: string) => {
  await input(page).fill(title);
  await input(page).press("Enter");
  await expect(rowOf(page, title)).toBeVisible();
};

/** Hovers over the row, as a person would to see the button, then removes it (deviation 11). */
const remove = async (page: Page, title: string) => {
  await rowOf(page, title).hover();
  await removeOf(page, title).click();
};

/** Removes every todo through the page, one at a time, until there is no list. */
const removeAll = async (page: Page) => {
  let count = await items(page).count();
  while (count > 0) {
    const first = items(page).first();
    await first.hover();
    await first.getByRole("button", { name: /^Remove ‘/ }).click();
    await expect(items(page)).toHaveCount(count - 1);
    count = count - 1;
  }
};

test("5.1 given buy milk and walk dog, when I hover over buy milk and click its remove button, then only walk dog is left", async ({
  page,
}) => {
  await open(page);
  await removeAll(page);
  await add(page, "buy milk");
  await add(page, "walk dog");

  await remove(page, "buy milk");

  await expect(items(page)).toHaveCount(1);
  await expect(rowOf(page, "walk dog")).toBeVisible();
  await page.reload();
  await expect(items(page)).toHaveCount(1);
  await expect(rowOf(page, "walk dog")).toBeVisible();
});

test("5.2 given only buy milk, when I remove it, then there is no list and no footer", async ({ page }) => {
  await open(page);
  await removeAll(page);
  await add(page, "buy milk");

  await remove(page, "buy milk");

  await expect(page.getByRole("list")).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
});
