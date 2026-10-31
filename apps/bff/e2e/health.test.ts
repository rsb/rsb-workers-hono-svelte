import { expect, test } from "@playwright/test";

// PRD scenario 1.1 (deviation 13).
test("given both Workers are running, /health shows the API is up", async ({ page }) => {
  await page.goto("/health");

  await expect(page.getByText("The API is up.")).toBeVisible();
});
