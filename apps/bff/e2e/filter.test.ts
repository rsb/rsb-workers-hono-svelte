import { type Page, expect } from "@playwright/test";
import { test } from "./signed-in.ts";
import { add, input, items, open, removeAll, rowOf } from "./todos.ts";

// PRD scenarios 8.1–8.7. Each test first removes every todo through the
// page, so its "given" is exactly true (see todos.ts).

const checkOf = (page: Page, title: string) => page.getByRole("checkbox", { name: title, exact: true });
const clear = (page: Page) => page.getByRole("button", { name: "Clear completed", exact: true });
const filters = (page: Page) => page.getByRole("navigation", { name: "Filter to-dos" });
const filterLink = (page: Page, name: string) => filters(page).getByRole("link", { name, exact: true });

/** Starts from buy milk completed and walk dog active, then opens `path`. */
const givenOneOfEach = async (page: Page, path: string) => {
  await open(page);
  await removeAll(page);
  await add(page, "buy milk");
  await add(page, "walk dog");
  await checkOf(page, "buy milk").click();
  // The check shows at once; the counter changes only once the toggle is
  // saved and the page has reloaded, so leaving after it cuts no request.
  await expect(page.getByText("1 item left")).toBeVisible();
  await open(page, path);
};

test("8.1 given one active and one completed todo, when I open /active, then only the active one is listed", async ({
  page,
}) => {
  await givenOneOfEach(page, "/active");

  await expect(items(page)).toHaveCount(1);
  await expect(rowOf(page, "walk dog")).toBeVisible();
});

test("8.2 when I open /completed, then only the completed one is listed", async ({ page }) => {
  await givenOneOfEach(page, "/completed");

  await expect(items(page)).toHaveCount(1);
  await expect(rowOf(page, "buy milk")).toBeVisible();
});

test("8.3 when I open /, then both are listed", async ({ page }) => {
  await givenOneOfEach(page, "/");

  await expect(items(page)).toHaveCount(2);
  await expect(rowOf(page, "buy milk")).toBeVisible();
  await expect(rowOf(page, "walk dog")).toBeVisible();
});

test("8.4 given I am on /active, then the Active link is current and no other is; a link moves it", async ({
  page,
}) => {
  await givenOneOfEach(page, "/active");

  await expect(filterLink(page, "Active")).toHaveAttribute("aria-current", "page");
  await expect(filterLink(page, "All")).not.toHaveAttribute("aria-current");
  await expect(filterLink(page, "Completed")).not.toHaveAttribute("aria-current");

  // From the keyboard: focus stays on the link pressed.
  await filterLink(page, "Completed").focus();
  await filterLink(page, "Completed").press("Enter");

  await expect(page).toHaveURL(/\/completed$/);
  await expect(filterLink(page, "Completed")).toBeFocused();
  await expect(filterLink(page, "Completed")).toHaveAttribute("aria-current", "page");
  await expect(filterLink(page, "Active")).not.toHaveAttribute("aria-current");
  await expect(items(page)).toHaveCount(1);
  await expect(rowOf(page, "buy milk")).toBeVisible();
});

test("8.5 given I am on /active, when I check a todo, then it is no longer listed", async ({ page }) => {
  await givenOneOfEach(page, "/active");

  // From the keyboard, so focus is on the check when its row goes.
  await checkOf(page, "walk dog").focus();
  await checkOf(page, "walk dog").press("Enter");

  await expect(items(page)).toHaveCount(0);
  await expect(page.getByText("0 items left")).toBeVisible();
  await expect(input(page)).toBeFocused();
});

test("8.6 given I am on /completed, when I reload, then I am still on /completed with the same list", async ({
  page,
}) => {
  await givenOneOfEach(page, "/completed");

  await page.reload();

  await expect(page).toHaveURL(/\/completed$/);
  await expect(filterLink(page, "Completed")).toHaveAttribute("aria-current", "page");
  await expect(items(page)).toHaveCount(1);
  await expect(rowOf(page, "buy milk")).toBeVisible();
});

test("8.7 given I am on /active, then the counter and Clear completed reflect all todos", async ({ page }) => {
  await givenOneOfEach(page, "/active");

  await expect(page.getByText("1 item left")).toBeVisible();
  await expect(clear(page)).toBeVisible();
});
