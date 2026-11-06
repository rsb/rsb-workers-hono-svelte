import { type Locator, type Page, expect } from "@playwright/test";
import { test } from "./signed-in.ts";

// PRD scenarios 2.1–2.8. The API's store is shared by the whole run (D19):
// 2.1 needs it empty and runs first; the rest assert on the end of the list.

const input = (page: Page) => page.getByRole("textbox", { name: "New to-do" });
const items = (page: Page) => page.getByRole("listitem");

/** A row's title, as its checkbox is named by it. The title button also says how to edit. */
const titleOf = (item: Locator) => item.getByRole("checkbox");

/** Types a title and presses Enter. Returns how many todos were listed before. */
const submit = async (page: Page, title: string) => {
  const before = await items(page).count();
  await input(page).fill(title);
  await input(page).press("Enter");
  return before;
};

/** Adds a todo and waits until the list has grown by one. */
const add = async (page: Page, title: string) => {
  const before = await submit(page, title);
  await expect(items(page)).toHaveCount(before + 1);
};

test("2.1 given no todos, when I open /, then there is no list and no footer, and a message points to the input", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("list")).toHaveCount(0);
  await expect(page.getByText("Nothing to do yet.")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
});

test("2.2 given I open /, then the new-todo input has focus", async ({ page }) => {
  await page.goto("/");

  await expect(input(page)).toBeFocused();
});

test("2.3 when I type buy milk and press Enter, then the list shows it and the input is empty", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "buy milk");

  await expect(titleOf(items(page).last())).toHaveAccessibleName("buy milk");
  await expect(input(page)).toHaveValue("");
});

test("2.4 given buy milk, when I add walk dog, then walk dog is below buy milk", async ({ page }) => {
  await page.goto("/");
  await add(page, "buy milk");
  await add(page, "walk dog");

  await expect(titleOf(items(page).nth(-2))).toHaveAccessibleName("buy milk");
  await expect(titleOf(items(page).last())).toHaveAccessibleName("walk dog");
});

test("2.5 when I add a title with spaces around it, then the list shows it trimmed", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "  buy milk  ");

  await expect(titleOf(items(page).last())).toHaveAccessibleName("buy milk");
});

test("2.6 when I press Enter on only spaces, then no todo is added and I see why", async ({ page }) => {
  await page.goto("/");
  const before = await submit(page, "   ");

  await expect(input(page)).toHaveAccessibleDescription("Title must be 1 to 256 characters");
  await expect(items(page)).toHaveCount(before);
});

test("2.7 when I add a title of 257 characters, then no todo is added, I see why, and the input keeps it", async ({
  page,
}) => {
  await page.goto("/");
  const title = "x".repeat(257);
  const before = await submit(page, title);

  await expect(input(page)).toHaveAccessibleDescription("Title must be 1 to 256 characters");
  await expect(input(page)).toHaveValue(title);
  await expect(items(page)).toHaveCount(before);
});

test("2.8 given buy milk, when I reload, then buy milk is still there", async ({ page }) => {
  await page.goto("/");
  await add(page, "buy milk");

  await page.reload();

  await expect(titleOf(items(page).last())).toHaveAccessibleName("buy milk");
});
