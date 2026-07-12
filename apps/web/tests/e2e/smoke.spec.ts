import { test, expect } from "@playwright/test";

import { loginUser, requireUserCredentials } from "./helpers";

test("public landing has no app chrome and sign-in route exists", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /ReCalc UNIDEP/i })).toBeVisible();

  // Branding: logo + favicon links (favicon may require hard refresh in real browsers).
  await expect(page.locator("header").getByAltText("ReCalc")).toBeVisible();
  const iconHrefs = await page.$$eval('link[rel~="icon"]', (els) =>
    els.map((e) => e.getAttribute("href") || "")
  );
  expect(iconHrefs.join(" ")).toContain("/icons/icon32.png");
  const appleHref = await page.$eval('link[rel="apple-touch-icon"]', (e) =>
    (e as HTMLLinkElement).href
  );
  expect(appleHref).toContain("/icons/apple-touch-icon.png");

  await expect(page.getByRole("navigation", { name: /Navegación/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Abrir menú/i })).toHaveCount(0);

  await Promise.all([
    page.waitForURL(/\/auth\/sign-in/),
    page.getByRole("link", { name: /Ingresar|Iniciar sesión/i }).first().click(),
  ]);
  await expect(page.getByRole("textbox", { name: "Correo", exact: true })).toBeVisible();
});

test("sign-in works and /unidep loads app chrome (requires E2E_EMAIL/E2E_PASSWORD)", async ({
  page,
}) => {
  const { email, password } = requireUserCredentials();

  await loginUser(page, email, password);

  await expect(page).toHaveURL(/\/unidep/);
  await expect(
    page.getByRole("heading", { name: /Cotizador|Calculadora/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Abrir menú/i })).toBeVisible();
});

test("session survives reload and sign-out clears protected access (requires E2E_EMAIL/E2E_PASSWORD)", async ({
  page,
}) => {
  const { email, password } = requireUserCredentials();

  await loginUser(page, email, password);
  await page.reload();

  await expect(page).toHaveURL(/\/unidep/);
  await expect(
    page.getByRole("heading", { name: /Cotizador|Calculadora/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Cerrar sesi/i }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/unidep");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});
