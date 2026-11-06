import { type Page, expect } from "@playwright/test";
import { test } from "./signed-in.ts";

// PRD scenarios 3.1–3.5. The API's store is shared by the whole run (D19),
// and earlier files leave todos in it. These tests were written before a
// todo could be removed: 3.1 and 3.2 toggle a todo they add, and the
// counter scenarios first complete every todo, so from there the count is
// known. They run in file order: 3.5, then 3.3, then 3.4.

const input = (page: Page) => page.getByRole("textbox", { name: "New to-do" });
const items = (page: Page) => page.getByRole("listitem");
const counter = (page: Page) => page.getByText(/^\d+ items? left$/);
const activeChecks = (page: Page) => page.getByRole("checkbox", { checked: false });

/** Adds a todo and waits until the list has grown by one. */
const add = async (page: Page, title: string) => {
  const before = await items(page).count();
  await input(page).fill(title);
  await input(page).press("Enter");
  await expect(items(page)).toHaveCount(before + 1);
};

/** How many items the counter says are left. */
const left = async (page: Page) => {
  const text = await counter(page).textContent();
  return Number.parseInt(text ?? "", 10);
};

/** Completes every active todo, one click each, and waits until the API agrees. */
const completeAll = async (page: Page) => {
  let remaining = await activeChecks(page).count();
  while (remaining > 0) {
    await activeChecks(page).first().click();
    await expect(activeChecks(page)).toHaveCount(remaining - 1);
    remaining = remaining - 1;
  }
  await expect(counter(page)).toHaveText("0 items left");
};

test("3.1 given buy milk, active, when I click its checkbox, then it shows as completed", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "buy milk");
  const check = items(page).last().getByRole("checkbox", { name: "buy milk" });
  await expect(check).not.toBeChecked();
  const before = await left(page);

  await check.click();

  await expect(check).toBeChecked();
  // The counter comes from the reloaded list, so the API has it too.
  await expect(counter(page)).toHaveText(new RegExp(`^${before - 1} `));
});

test("3.2 given buy milk, completed, when I click its checkbox, then it shows as active", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "buy milk");
  const check = items(page).last().getByRole("checkbox", { name: "buy milk" });
  const before = await left(page);
  await check.click();
  await expect(check).toBeChecked();
  // The check shows the click at once; the counter waits for the API.
  await expect(counter(page)).toHaveText(new RegExp(`^${before - 1} `));

  await check.click();

  await expect(check).not.toBeChecked();
  await expect(counter(page)).toHaveText(new RegExp(`^${before} `));
});

test("3.5 given one todo, completed, then the counter reads 0 items left", async ({ page }) => {
  await page.goto("/");

  await completeAll(page);

  await expect(counter(page)).toHaveText("0 items left");
});

test("3.3 given one active todo, then the counter reads 1 item left", async ({ page }) => {
  await page.goto("/");
  await completeAll(page);

  await add(page, "walk dog");

  await expect(counter(page)).toHaveText("1 item left");
});

test("3.4 given two active todos, then the counter reads 2 items left", async ({ page }) => {
  await page.goto("/");
  await completeAll(page);

  await add(page, "walk dog");
  await add(page, "feed cat");

  await expect(counter(page)).toHaveText("2 items left");
});
