import { expect, test } from "@playwright/test";

test("shell and overview render", async ({ page }) => {
  await page.goto("/overview");

  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByTestId("side-nav")).toBeVisible();
  await expect(page.getByTestId("content-panel")).toContainText("Overview");
  await expect(page.getByText("Waiting for /odom messages from rosbridge...")).toBeVisible();
});
