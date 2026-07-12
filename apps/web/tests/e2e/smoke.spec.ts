import { test, expect } from "@playwright/test";

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
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run this test.");

  await page.goto("/auth/sign-in");
  await page.getByRole("textbox", { name: "Correo", exact: true }).fill(email!);
  await page.getByLabel(/^Contraseña$/i).fill(password!);
  await page.getByRole("button", { name: /Iniciar sesi/i }).click();

  await expect(page).toHaveURL(/\/unidep/);
  await expect(
    page.getByRole("heading", { name: /Cotizador|Calculadora/i }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Navegación/i })).toBeVisible();
});
