import { type Page, expect } from "@playwright/test";

// Helpers shared by the e2e files. The API's store is shared by the whole
// run (D19), and earlier files leave todos in it, so a file whose "given"
// needs an exact list starts with `removeAll`.

export const input = (page: Page) => page.getByRole("textbox", { name: "New to-do" });
export const items = (page: Page) => page.getByRole("listitem");

/** The row of the todo with this title, found by its checkbox. */
export const rowOf = (page: Page, title: string) =>
  items(page).filter({ has: page.getByRole("checkbox", { name: title, exact: true }) });

/** Opens the page and waits until the client has loaded. */
export const open = async (page: Page) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
};

/** Adds a todo and waits until its row shows. */
export const add = async (page: Page, title: string) => {
  await input(page).fill(title);
  await input(page).press("Enter");
  await expect(rowOf(page, title)).toBeVisible();
};

/** Removes every todo through the page, one at a time, until there is no list. */
export const removeAll = async (page: Page) => {
  let count = await items(page).count();
  while (count > 0) {
    const first = items(page).first();
    await first.hover();
    await first.getByRole("button", { name: /^Remove ‘/ }).click();
    await expect(items(page)).toHaveCount(count - 1);
    count = count - 1;
  }
};
