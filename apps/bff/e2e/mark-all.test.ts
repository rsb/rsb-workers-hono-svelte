import { type Page, expect, test } from "@playwright/test";
import { add, items, open, removeAll, rowOf } from "./todos.ts";

// PRD scenarios 6.1–6.4, and mark all shown only when there are todos
// (deviation 20). Each test first removes every todo through the page, so
// its "given" is exactly true (see todos.ts).

const markAll = (page: Page) => page.getByRole("button", { name: "Mark all as complete", exact: true });
const checkOf = (page: Page, title: string) => page.getByRole("checkbox", { name: title, exact: true });

/** Starts from buy milk and walk dog, both active. */
const givenTwoActive = async (page: Page) => {
  await open(page);
  await removeAll(page);
  await add(page, "buy milk");
  await add(page, "walk dog");
};

test("given no todos, there is no mark all; after an add, there is", async ({ page }) => {
  await open(page);
  await removeAll(page);

  await expect(markAll(page)).toHaveCount(0);

  await add(page, "buy milk");
  await expect(markAll(page)).toBeVisible();
  await expect(markAll(page)).toHaveAttribute("aria-pressed", "false");
});

test("6.1 given two active todos, when I press mark all, then both are completed", async ({ page }) => {
  await givenTwoActive(page);

  await markAll(page).click();

  await expect(checkOf(page, "buy milk")).toBeChecked();
  await expect(checkOf(page, "walk dog")).toBeChecked();
  await expect(markAll(page)).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(checkOf(page, "buy milk")).toBeChecked();
  await expect(checkOf(page, "walk dog")).toBeChecked();
  await expect(page.getByText("0 items left")).toBeVisible();
});

test("6.2 given two completed todos, when I press mark all again, then both are active", async ({ page }) => {
  await givenTwoActive(page);
  await markAll(page).click();
  await expect(markAll(page)).toHaveAttribute("aria-pressed", "true");

  await markAll(page).click();

  await expect(checkOf(page, "buy milk")).not.toBeChecked();
  await expect(checkOf(page, "walk dog")).not.toBeChecked();
  await expect(markAll(page)).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.getByText("2 items left")).toBeVisible();
});

test("6.3 given two active todos, when I check each one, then mark all shows as pressed", async ({ page }) => {
  await givenTwoActive(page);

  await checkOf(page, "buy milk").click();
  await expect(markAll(page)).toHaveAttribute("aria-pressed", "false");
  await checkOf(page, "walk dog").click();

  await expect(markAll(page)).toHaveAttribute("aria-pressed", "true");
});

test("6.4 given every todo completed, when I uncheck one, then mark all no longer shows as pressed", async ({
  page,
}) => {
  await givenTwoActive(page);
  await markAll(page).click();
  await expect(markAll(page)).toHaveAttribute("aria-pressed", "true");

  await checkOf(page, "walk dog").click();

  await expect(markAll(page)).toHaveAttribute("aria-pressed", "false");
  await expect(rowOf(page, "buy milk")).toBeVisible();
  await expect(items(page)).toHaveCount(2);
});
