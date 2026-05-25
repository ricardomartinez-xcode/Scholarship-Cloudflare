import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loginAdmin, loginUser, getAdminCredentials, getUserCredentials, waitForCalculatorReady } from "./helpers";

const SNAPSHOT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "visual-regression.spec.ts-snapshots",
);

function expectedSnapshotPath(projectName: string, snapshotName: string) {
  const ext = path.extname(snapshotName);
  const baseName = snapshotName.slice(0, -ext.length);
  return path.join(SNAPSHOT_DIR, `${baseName}-${projectName}-${process.platform}${ext}`);
}

function requireBaselines(
  testInfo: TestInfo,
  snapshotNames: string[],
) {
  const missing = snapshotNames.filter(
    (snapshotName) => !fs.existsSync(expectedSnapshotPath(testInfo.project.name, snapshotName)),
  );
  test.skip(
    missing.length > 0,
    `Missing visual baseline(s) for ${testInfo.project.name}/${process.platform}: ${missing.join(", ")}`,
  );
}

async function waitForStablePublicSurface(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(250);
}

test("visual: public desktop surfaces stay stable", async ({ page }, testInfo) => {
  requireBaselines(testInfo, [
    "public-home-desktop.png",
    "public-signin-desktop.png",
    "admin-auth-desktop.png",
  ]);
  await page.setViewportSize({ width: 1440, height: 960 });

  await page.goto("/");
  await waitForStablePublicSurface(page, /ReCalc UNIDEP/i);
  await expect(page).toHaveScreenshot("public-home-desktop.png", {
    animations: "disabled",
    caret: "hide",
  });

  await page.goto("/auth/sign-in");
  await waitForStablePublicSurface(page, /Continuar con Google/i);
  await expect(page).toHaveScreenshot("public-signin-desktop.png", {
    animations: "disabled",
    caret: "hide",
  });

  await page.goto("/admin/auth");
  await waitForStablePublicSurface(page, /Valida tu acceso administrativo/i);
  await expect(page).toHaveScreenshot("admin-auth-desktop.png", {
    animations: "disabled",
    caret: "hide",
  });
});

test("visual: public mobile surfaces stay stable", async ({ page }, testInfo) => {
  requireBaselines(testInfo, [
    "public-home-mobile.png",
    "public-signin-mobile.png",
    "admin-auth-mobile.png",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/");
  await waitForStablePublicSurface(page, /ReCalc UNIDEP/i);
  await expect(page).toHaveScreenshot("public-home-mobile.png", {
    animations: "disabled",
    caret: "hide",
  });

  await page.goto("/auth/sign-in");
  await waitForStablePublicSurface(page, /Continuar con Google/i);
  await expect(page).toHaveScreenshot("public-signin-mobile.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.03,
  });

  await page.goto("/admin/auth");
  await waitForStablePublicSurface(page, /Valida tu acceso administrativo/i);
  await expect(page).toHaveScreenshot("admin-auth-mobile.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.03,
  });
});

test("visual: authenticated workspaces stay stable when creds are available", async ({ page }, testInfo) => {
  const user = getUserCredentials();
  const admin = getAdminCredentials();
  test.skip(
    !user.email || !user.password || !admin.email || !admin.password,
    "Set E2E_EMAIL/E2E_PASSWORD and E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD to run this test.",
  );
  requireBaselines(testInfo, [
    "unidep-desktop.png",
    "admin-benefits-desktop.png",
  ]);

  await page.setViewportSize({ width: 1440, height: 960 });
  await loginUser(page, user.email!, user.password!);
  await waitForCalculatorReady(page);
  await expect(page).toHaveScreenshot("unidep-desktop.png", {
    animations: "disabled",
    caret: "hide",
  });

  await loginAdmin(page, admin.email!, admin.password!);
  await page.goto("/admin/benefits");
  await expect(page).toHaveScreenshot("admin-benefits-desktop.png", {
    animations: "disabled",
    caret: "hide",
  });
});
