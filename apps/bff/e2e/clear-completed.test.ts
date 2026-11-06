import { type Page, expect } from "@playwright/test";
import { test } from "./signed-in.ts";
import { add, input, items, open, removeAll, rowOf } from "./todos.ts";

// PRD scenarios 7.1–7.3. Each test first removes every todo through the
// page, so its "given" is exactly true (see todos.ts).

const clear = (page: Page) => page.getByRole("button", { name: "Clear completed", exact: true });
const markAll = (page: Page) => page.getByRole("button", { name: "Mark all as complete", exact: true });
const checkOf = (page: Page, title: string) => page.getByRole("checkbox", { name: title, exact: true });

/** Starts from buy milk and walk dog, both active. */
const givenTwoActive = async (page: Page) => {
  await open(page);
  await removeAll(page);
  await add(page, "buy milk");
  await add(page, "walk dog");
};

test("7.1 given no completed todos, then Clear completed is not shown; once one is, it is", async ({ page }) => {
  await givenTwoActive(page);

  await expect(clear(page)).toHaveCount(0);

  await checkOf(page, "buy milk").click();
  await expect(clear(page)).toBeVisible();
});

test("7.2 given buy milk completed and walk dog active, when I clear completed, then only walk dog remains", async ({
  page,
}) => {
  await givenTwoActive(page);
  await checkOf(page, "buy milk").click();
  await expect(checkOf(page, "buy milk")).toBeChecked();

  await clear(page).click();

  await expect(items(page)).toHaveCount(1);
  await expect(rowOf(page, "walk dog")).toBeVisible();
  await expect(clear(page)).toHaveCount(0);
  await expect(page.getByText("1 item left")).toBeVisible();
  await page.reload();
  await expect(items(page)).toHaveCount(1);
  await expect(rowOf(page, "walk dog")).toBeVisible();
});

test("7.3 given every todo completed by mark all, when I clear completed, then mark all is not shown", async ({
  page,
}) => {
  await givenTwoActive(page);
  await markAll(page).click();
  await expect(markAll(page)).toHaveAttribute("aria-pressed", "true");

  // From the keyboard, so focus is on the button when it goes.
  await clear(page).focus();
  await clear(page).press("Enter");

  await expect(items(page)).toHaveCount(0);
  await expect(markAll(page)).toHaveCount(0);
  await expect(clear(page)).toHaveCount(0);
  await expect(page.getByText(/items? left/)).toHaveCount(0);
  await expect(input(page)).toBeFocused();
});
