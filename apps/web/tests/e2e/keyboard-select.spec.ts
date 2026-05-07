import { test, expect } from "@playwright/test";

test("AppSelect supports keyboard navigation and selection (requires E2E_EMAIL/E2E_PASSWORD)", async ({
  page,
}) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run this test.");

  await page.goto("/auth/sign-in");
  await page.getByLabel(/Correo/i).fill(email!);
  await page.getByLabel(/^Contraseña$/i).fill(password!);
  await page.getByRole("button", { name: /Iniciar sesi/i }).click();
  await expect(page).toHaveURL(/\/unidep/);

  const tipo = page.getByRole("combobox", { name: /Tipo de inscripci[oó]n/i });
  await expect(tipo).toBeVisible();

  await tipo.click();
  await expect(page.getByRole("option", { name: /Nuevo ingreso/i })).toBeVisible();

  // Ensure focus moved into the listbox on open so ArrowUp/ArrowDown work.
  await expect
    .poll(async () => {
      return page.evaluate(() => document.activeElement?.getAttribute("role") ?? "");
    })
    .toBe("option");

  await page.keyboard.press("ArrowDown");
  const highlighted = page.locator(".ui-select-item[data-highlighted]");
  await expect(highlighted).toBeVisible();
  await expect(highlighted).toContainText(/Regreso/i);
  await page.keyboard.press("Enter");

  // Some environments commit selection on Space instead of Enter.
  if (!/Regreso/i.test((await tipo.textContent()) ?? "")) {
    await tipo.click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" ");
  }

  await expect(tipo).toContainText(/Regreso/i);

  await tipo.click();
  await expect(page.getByRole("option", { name: /Nuevo ingreso/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("option", { name: /Nuevo ingreso/i })).toHaveCount(0);
});
