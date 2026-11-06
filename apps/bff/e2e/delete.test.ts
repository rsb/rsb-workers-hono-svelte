import { type Page, expect } from "@playwright/test";
import { test } from "./signed-in.ts";
import { add, items, open, removeAll, rowOf } from "./todos.ts";

// PRD scenarios 5.1 and 5.2. Each test first removes every todo through
// the page, so its "given" is exactly true (see todos.ts).

/** The remove button of the todo with this title. */
const removeOf = (page: Page, title: string) => page.getByRole("button", { name: `Remove ‘${title}’`, exact: true });

/** Hovers over the row, as a person would to see the button, then removes it (deviation 11). */
const remove = async (page: Page, title: string) => {
  await rowOf(page, title).hover();
  await removeOf(page, title).click();
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
