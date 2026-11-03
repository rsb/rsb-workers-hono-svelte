import { type Page, expect, test } from "@playwright/test";

// PRD scenarios 4.1–4.9. The API's store is shared by the whole run (D19),
// so each test adds its own todo with a unique title and finds it by that.

const input = (page: Page) => page.getByRole("textbox", { name: "New to-do" });
const editInput = (page: Page) => page.getByRole("textbox", { name: "Edit to-do" });

/** The title as the start of a pattern, its special characters escaped. */
const startsWith = (title: string) => new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

/**
 * The title button of the todo with this title. Its name also says how to
 * edit, and Chromium puts a space between the two spans, so the name is
 * matched by how it starts. The remove button's name, "Remove ‘title’",
 * also holds the title, but does not start with it. Titles are unique.
 */
const titleOf = (page: Page, title: string) => page.getByRole("button", { name: startsWith(title) });

/** The remove button of the todo with this title. */
const removeOf = (page: Page, title: string) => page.getByRole("button", { name: `Remove ‘${title}’`, exact: true });

/** The row of the todo with this title, found by its checkbox. */
const rowOf = (page: Page, title: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("checkbox", { name: title, exact: true }) });

/** A title no other test uses, so the shared list never confuses two. */
const unique = (title: string) => `${title} ${crypto.randomUUID().slice(0, 8)}`;

/**
 * Opens the page and waits until the client has loaded. Editing needs
 * JavaScript; before hydration a double-click or Enter does nothing, and an
 * add is a full page post.
 */
const open = async (page: Page) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
};

/** Adds a todo and waits until its title shows. */
const add = async (page: Page, title: string) => {
  await input(page).fill(title);
  await input(page).press("Enter");
  await expect(titleOf(page, title)).toBeVisible();
};

/** Opens the page with a new todo of this title, in editing mode. */
const editing = async (page: Page, title: string) => {
  await open(page);
  await add(page, title);
  await titleOf(page, title).dblclick();
  await expect(editInput(page)).toBeFocused();
};

test("4.1 when I double-click its title, then it is in editing mode with the title, focused", async ({ page }) => {
  const title = unique("buy milk");
  await open(page);
  await add(page, title);

  await titleOf(page, title).dblclick();

  await expect(editInput(page)).toHaveValue(title);
  await expect(editInput(page)).toBeFocused();
  // The check stays while editing; only the remove button is hidden (PRD deviation 18).
  await expect(rowOf(page, title).getByRole("checkbox")).toBeVisible();
  await expect(removeOf(page, title)).toHaveCount(0);
});

test("4.2 when I change the text and press Enter, then the title is saved", async ({ page }) => {
  const title = unique("buy milk");
  const renamed = unique("buy bread");
  await editing(page, title);

  await editInput(page).fill(renamed);
  await editInput(page).press("Enter");

  await expect(titleOf(page, renamed)).toBeVisible();
  await expect(editInput(page)).toHaveCount(0);
  // Back from the keyboard, focus is on the title again.
  await expect(titleOf(page, renamed)).toBeFocused();
  await page.reload();
  await expect(titleOf(page, renamed)).toBeVisible();
});

test("4.3 when I change the text and focus leaves the input, then the title is saved", async ({ page }) => {
  const title = unique("buy milk");
  const renamed = unique("buy bread");
  await editing(page, title);

  await editInput(page).fill(renamed);
  await input(page).click();

  await expect(titleOf(page, renamed)).toBeVisible();
  await expect(editInput(page)).toHaveCount(0);
  await page.reload();
  await expect(titleOf(page, renamed)).toBeVisible();
});

test("4.4 when I save a title with spaces around it, then it is saved trimmed", async ({ page }) => {
  const title = unique("buy milk");
  const renamed = unique("buy bread");
  await editing(page, title);

  await editInput(page).fill(`   ${renamed}   `);
  await editInput(page).press("Enter");

  await expect(titleOf(page, renamed)).toBeVisible();
});

test("4.5 when I clear the text and press Enter, then the todo is unchanged", async ({ page }) => {
  const title = unique("buy milk");
  await editing(page, title);

  await editInput(page).fill("");
  await editInput(page).press("Enter");

  await expect(editInput(page)).toHaveCount(0);
  await expect(titleOf(page, title)).toBeVisible();
  await page.reload();
  await expect(titleOf(page, title)).toBeVisible();
});

test("4.6 when I change the text and press Escape, then the change is discarded", async ({ page }) => {
  const title = unique("buy milk");
  await editing(page, title);

  await editInput(page).fill("something else");
  await editInput(page).press("Escape");

  await expect(editInput(page)).toHaveCount(0);
  await expect(titleOf(page, title)).toBeFocused();
  await page.reload();
  await expect(titleOf(page, title)).toBeVisible();
});

test("4.7 when I enter 257 characters and press Enter, then the todo is unchanged and the rule shows", async ({
  page,
}) => {
  const title = unique("buy milk");
  const tooLong = "x".repeat(257);
  await editing(page, title);

  await editInput(page).fill(tooLong);
  await editInput(page).press("Enter");

  await expect(page.getByText("Title must be 1 to 256 characters")).toBeVisible();
  await expect(editInput(page)).toHaveValue(tooLong);
  await expect(editInput(page)).toBeFocused();
  // Typing again clears the message.
  await editInput(page).press("Backspace");
  await expect(page.getByText("Title must be 1 to 256 characters")).toHaveCount(0);
  await page.reload();
  await expect(titleOf(page, title)).toBeVisible();
});

test("4.8 given a todo in editing mode, when I reload, then it is not in editing mode", async ({ page }) => {
  const title = unique("buy milk");
  await editing(page, title);

  await page.reload();

  await expect(editInput(page)).toHaveCount(0);
  await expect(titleOf(page, title)).toBeVisible();
});

test("4.9 given the title has focus, when I press Enter, then it is in editing mode", async ({ page }) => {
  const title = unique("buy milk");
  await open(page);
  await add(page, title);
  await titleOf(page, title).focus();

  await page.keyboard.press("Enter");

  await expect(editInput(page)).toHaveValue(title);
  await expect(editInput(page)).toBeFocused();
});

test("a failed add keeps its text and message when a todo is toggled", async ({ page }) => {
  const title = unique("buy milk");
  const tooLong = "x".repeat(257);
  await open(page);
  await add(page, title);
  await input(page).fill(tooLong);
  await input(page).press("Enter");
  await expect(page.getByText("Title must be 1 to 256 characters")).toBeVisible();

  await rowOf(page, title).getByRole("checkbox").click();
  await expect(rowOf(page, title).getByRole("checkbox")).toBeChecked();

  await expect(input(page)).toHaveValue(tooLong);
  await expect(page.getByText("Title must be 1 to 256 characters")).toBeVisible();
});
