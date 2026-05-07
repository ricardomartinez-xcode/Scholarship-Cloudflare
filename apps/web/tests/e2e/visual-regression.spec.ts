import { expect, test } from "@playwright/test";

import { loginAdmin, loginUser, getAdminCredentials, getUserCredentials, waitForCalculatorReady } from "./helpers";

test("visual: public desktop surfaces stay stable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });

  await page.goto("/");
  await expect(page).toHaveScreenshot("public-home-desktop.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
  });

  await page.goto("/auth/sign-in");
  await expect(page).toHaveScreenshot("public-signin-desktop.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
  });

  await page.goto("/admin/auth");
  await expect(page).toHaveScreenshot("admin-auth-desktop.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
  });
});

test("visual: public mobile surfaces stay stable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/");
  await expect(page).toHaveScreenshot("public-home-mobile.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
  });

  await page.goto("/auth/sign-in");
  await expect(page).toHaveScreenshot("public-signin-mobile.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    maxDiffPixelRatio: 0.03,
  });

  await page.goto("/admin/auth");
  await expect(page).toHaveScreenshot("admin-auth-mobile.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    maxDiffPixelRatio: 0.03,
  });
});

test("visual: authenticated workspaces stay stable when creds are available", async ({ page }) => {
  const user = getUserCredentials();
  const admin = getAdminCredentials();
  test.skip(
    !user.email || !user.password || !admin.email || !admin.password,
    "Set E2E_EMAIL/E2E_PASSWORD and E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD to run this test.",
  );

  await page.setViewportSize({ width: 1440, height: 960 });
  await loginUser(page, user.email!, user.password!);
  await waitForCalculatorReady(page);
  await expect(page).toHaveScreenshot("unidep-desktop.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
  });

  await loginAdmin(page, admin.email!, admin.password!);
  await page.goto("/admin/benefits");
  await expect(page).toHaveScreenshot("admin-benefits-desktop.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
  });
});
