import { type Page, expect, test } from "@playwright/test";
import { BASE, passwordOf } from "./signed-in.ts";
import { input, open } from "./todos.ts";

// Scenarios B.1 to B.5 (`feature-accounts-sign-in.md` › B). Playwright's
// own `test`: each starts with no cookie and signs in through the page, so
// it never ends the seeded session the other files use (a sign-in ends
// the session it presents, threats row 3). It signs in as the member the
// seed made, with the password the seed set; the api hashes it in workerd
// and the seed in Node, so B.1 is also the proof that the two agree.

const MEMBER = "member@example.test";
const WRONG = "That email and password don’t match an account. Check both and try again.";

const email = (page: Page) => page.getByLabel("Email");
const password = (page: Page) => page.getByLabel("Password");
const submit = (page: Page) => page.getByRole("button", { name: "Sign in", exact: true });

const signInWith = async (page: Page, as: string, with_: string) => {
  await open(page, "/sign-in");
  await email(page).fill(as);
  await password(page).fill(with_);
  await submit(page).click();
};

const sessionCookie = async (page: Page) => (await page.context().cookies(BASE)).find((cookie) => cookie.name === "sid");

test("B.1 given the member's email and password, when I sign in, then I land on my list, signed in on this device", async ({
  page,
}) => {
  await signInWith(page, MEMBER, passwordOf("MEMBER_PASSWORD"));

  await expect(page).toHaveURL(`${BASE}/`);
  await expect(page.getByRole("button", { name: "Account: Dev Member" })).toBeVisible();
  await expect(input(page)).toBeVisible();
  const cookie = await sessionCookie(page);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  // Kept until the session's absolute expiry, not for the browser session.
  expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000);
});

test("B.1 the email is matched trimmed and lower-cased", async ({ page }) => {
  await signInWith(page, "  Member@Example.TEST ", passwordOf("MEMBER_PASSWORD"));

  await expect(page.getByRole("button", { name: "Account: Dev Member" })).toBeVisible();
});

test("B.2 given a wrong password, and given an email with no account, when I sign in, then I see the same words, and am not signed in", async ({
  page,
}) => {
  await signInWith(page, MEMBER, "not the password");
  await expect(page.getByRole("alert")).toHaveText(WRONG);
  await expect(email(page)).toHaveValue(MEMBER);
  await expect(password(page)).toHaveValue("");
  expect(await sessionCookie(page)).toBeUndefined();

  await signInWith(page, "nobody@example.test", "not the password");
  await expect(page.getByRole("alert")).toHaveText(WRONG);
  expect(await sessionCookie(page)).toBeUndefined();
});

test("B.2 the two refusals answer alike without JavaScript too: one status, one page", async ({ page }) => {
  // The form posts as a page without JavaScript would, so the BFF renders
  // the refusal as a page, not as the JSON `use:enhance` asks for.
  const post = (as: string) =>
    page.request.post(`${BASE}/sign-in`, {
      form: { email: as, password: "not the password" },
      headers: { Accept: "text/html", "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "navigate", Origin: BASE },
      maxRedirects: 0,
    });

  const known = await post(MEMBER);
  const unknown = await post("nobody@example.test");

  expect(known.status()).toBe(401);
  expect(unknown.status()).toBe(401);
  expect(await known.text()).toContain("That email and password don’t match an account.");
  expect(await unknown.text()).toContain("That email and password don’t match an account.");
});

test("B.3 given a malformed email and an empty password, when I sign in, then each field says what is wrong with it", async ({
  page,
}) => {
  await signInWith(page, "maya.example", "");

  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Password is required")).toBeVisible();
  await expect(email(page)).toHaveAttribute("aria-invalid", "true");
  await expect(password(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await sessionCookie(page)).toBeUndefined();
});

test("B.4 when I press a sign-in method that is coming, then it says it is not available yet", async ({ page }) => {
  await open(page, "/sign-in");

  await page.getByRole("button", { name: /Use a passkey/ }).click();

  await expect(page.getByText("Not available yet.")).toBeVisible();
  await expect(page).toHaveURL(`${BASE}/sign-in`);
});

test("B.5 given a sign-in not yet answered, then the button says Signing in… and is disabled; when it is answered, then I land on my list", async ({
  page,
}) => {
  // The post is held until the test has seen `pending`: a local sign-in
  // answers in about the time of one hash, too fast to look at otherwise.
  let release = () => {};
  let holding = false;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${BASE}/sign-in`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    holding = true;
    await held;
    await route.continue();
  });

  await signInWith(page, MEMBER, passwordOf("MEMBER_PASSWORD"));

  const pending = page.getByRole("button", { name: "Signing in…" });
  await expect(pending).toBeVisible();
  await expect(pending).toBeDisabled();
  // Seen while the post was held, not in a fast reply's moment.
  expect(holding).toBe(true);

  release();

  await expect(page).toHaveURL(`${BASE}/`);
  await expect(page.getByRole("button", { name: "Account: Dev Member" })).toBeVisible();
});
