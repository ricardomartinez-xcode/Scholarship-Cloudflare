import { test, expect, type Page } from "@playwright/test";

import { loginAdmin, requireAdminCredentials } from "./helpers";

const BLOCKED_CONSOLE_PATTERNS = [
  /DialogContent.*DialogTitle/i,
  /Missing `Description` or `aria-describedby`/i,
  /unexpectedly submitted/i,
];

async function expectDialogFitsViewport(page: Page) {
  const metrics = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const rect = dialog.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewportHeight: window.innerHeight,
      fitsViewport: rect.top >= 8 && rect.bottom <= window.innerHeight - 8,
      hasInternalScroll: dialog.scrollHeight > dialog.clientHeight,
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics?.fitsViewport).toBeTruthy();
}

test("admin dialogs keep title/description and fit the viewport (requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)", async ({
  page,
}) => {
  const { email, password } = requireAdminCredentials();

  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    consoleMessages.push(message.text());
  });

  await loginAdmin(page, email, password);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/admin/prices", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /Precios base y ajustes/i })).toBeVisible();

  const editButton = page.getByRole("button", { name: /^Editar$/i }).first();
  await expect(editButton).toBeVisible({ timeout: 30_000 });
  await editButton.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Nuevo monto \(MXN\)/i)).toBeVisible();
  await expectDialogFitsViewport(page);
  await page.getByRole("button", { name: /Cerrar/i }).click();

  await page.goto("/admin/ctas", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nuevo" }).click();
  await expect(page.getByRole("dialog", { name: /CTA/i })).toBeVisible();
  await expectDialogFitsViewport(page);

  const relevantErrors = consoleMessages.filter((message) =>
    BLOCKED_CONSOLE_PATTERNS.some((pattern) => pattern.test(message))
  );
  expect(relevantErrors).toEqual([]);
});

test("admin mobile shell exposes the menu and keeps content visible without horizontal overflow (requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)", async ({
  page,
}) => {
  const { email, password } = requireAdminCredentials();

  await loginAdmin(page, email, password);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/ctas", { waitUntil: "domcontentloaded" });
  const heading = page.getByRole("heading", { name: /CTAs/i }).first();
  await heading.scrollIntoViewIfNeeded();

  await expect(page.getByRole("button", { name: /Abrir menú/i })).toBeVisible();

  const metrics = await page.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  const headingBox = await heading.boundingBox();
  expect(headingBox).not.toBeNull();
  expect(headingBox?.y ?? 9999).toBeLessThan(260);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

  await page.getByRole("button", { name: /Abrir menú/i }).click();
  await expect(page.getByRole("dialog", { name: /Navegación admin/i })).toBeVisible();
});
