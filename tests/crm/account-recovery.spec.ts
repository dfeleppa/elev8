import { test, expect } from "@playwright/test";

test("legacy recovery links lead to OAuth-only login without consuming tokens", async ({ page }) => {
  const authRequests: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/auth/v1/")) authRequests.push(request.url());
  });
  await page.goto("/account-recovery#type=recovery&token_hash=unused-proof");
  await expect(page).toHaveURL(/\/login#?$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Apple" })).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(authRequests).toEqual([]);
});

test("registration offers configured providers after an invitation code", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByLabel("Invitation code")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Apple" })).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});
