import { type Browser, type Page, expect, test } from "@playwright/test";
import { type Seeded, signIn } from "./signed-in.ts";
import { add, items, open, removeAll, rowOf } from "./todos.ts";

// Scenario A.8 (`feature-todos-list.md` › A, deviation 21): the member and
// the admin share one database, and every todo operation is `own`, the
// admin's included (`access.md`). Each person has their own browser
// context, so each page carries one session cookie.

/** A page in a fresh browser context, signed in as the seeded person. */
const pageOf = async (browser: Browser, who: Seeded): Promise<Page> => {
  const context = await browser.newContext();
  await signIn(context, who);
  return context.newPage();
};

const counter = (page: Page) => page.getByText(/^\d+ items? left$/);

test("A.8 given the member's session and the member's todo buy milk, when the admin opens /, then buy milk is not listed, and the counter counts only the admin's todos", async ({
  browser,
}) => {
  const member = await pageOf(browser, "MEMBER_TOKEN");
  const admin = await pageOf(browser, "ADMIN_TOKEN");
  await open(member);
  await removeAll(member);
  await add(member, "buy milk");
  await open(admin);
  await removeAll(admin);
  await add(admin, "walk dog");

  await open(admin);

  await expect(rowOf(admin, "buy milk")).toHaveCount(0);
  await expect(items(admin)).toHaveCount(1);
  await expect(counter(admin)).toHaveText("1 item left");
  // The member's todo is still theirs, and still there.
  await open(member);
  await expect(rowOf(member, "buy milk")).toBeVisible();

  await removeAll(member);
  await removeAll(admin);
  await member.context().close();
  await admin.context().close();
});
