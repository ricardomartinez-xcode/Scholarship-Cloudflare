import { test, expect, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > window.innerWidth + 1;
  });
  expect(hasOverflow).toBeFalsy();
}

test("responsive: 375px public pages have no sidebar and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 820 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: /Navegación/i })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto("/auth/sign-in");
  await expect(page.getByRole("heading", { name: /Acceso/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Navegación/i })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("responsive: 375px /unidep keeps header intact and has no horizontal overflow (requires E2E_EMAIL/E2E_PASSWORD)", async ({
  page,
}) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run this test.");

  await page.setViewportSize({ width: 375, height: 820 });
  await page.goto("/auth/sign-in");
  await page.getByLabel(/Correo/i).fill(email!);
  await page.getByLabel(/^Contraseña$/i).fill(password!);
  await page.getByRole("button", { name: /Iniciar sesi/i }).click();
  await expect(page).toHaveURL(/\/unidep/);

  await expect(page.getByRole("img", { name: /UNIDEP/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Abrir menú/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
