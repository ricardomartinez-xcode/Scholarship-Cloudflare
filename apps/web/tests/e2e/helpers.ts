import { expect, type Locator, type Page, test } from "@playwright/test";

export function getUserCredentials() {
  return {
    email: process.env.E2E_EMAIL,
    password: process.env.E2E_PASSWORD,
  };
}

export function getAdminCredentials() {
  return {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
  };
}

export function requireUserCredentials() {
  const { email, password } = getUserCredentials();
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run this test.");
  return { email: email!, password: password! };
}

export function requireAdminCredentials() {
  const { email, password } = getAdminCredentials();
  test.skip(
    !email || !password,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.",
  );
  return { email: email!, password: password! };
}

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto("/auth/sign-in");
  const passwordMode = page.getByRole("button", {
    name: "Contraseña",
    exact: true,
  });
  if (await passwordMode.isVisible().catch(() => false)) {
    await passwordMode.click();
  }
  const emailField = page.getByLabel(/Correo/i);
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill(email);
    const passwordField = page.locator('input[name="password"]');
    await expect(passwordField).toBeVisible();
    await passwordField.fill(password);
    await page.getByRole("button", { name: /Iniciar sesi/i }).click();
  }
  await expect(page).toHaveURL(/\/unidep/, { timeout: 20_000 });
}

export async function loginAdmin(page: Page, email: string, password: string) {
  const adminUrlPattern = /\/admin(?:\/.*)?$/;

  await page.goto("/admin/auth");
  const emailField = page.getByLabel(/Correo/i);
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /Iniciar sesi/i }).click();
  }
  const reachedAdminFromAdminAuth = await page
    .waitForURL(adminUrlPattern, { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  if (!reachedAdminFromAdminAuth) {
    await page.goto(`/auth/sign-in?next=${encodeURIComponent("/admin")}`);
    const publicEmailField = page.getByLabel(/Correo/i);
    await expect(publicEmailField).toBeVisible({ timeout: 20_000 });
    await publicEmailField.fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /Iniciar sesi/i }).click();
  }

  await expect(page).toHaveURL(adminUrlPattern, { timeout: 30_000 });
}

export async function waitForCalculatorReady(page: Page) {
  await expect(
    page.getByRole("heading", { name: /Cotizador|Calculadora/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("combobox", { name: /Tipo de inscripción/i }),
  ).toBeVisible({ timeout: 30_000 });

  const loadingBox = page.getByText(/Cargando datos/i);
  if (await loadingBox.isVisible().catch(() => false)) {
    await expect(loadingBox).toBeHidden({ timeout: 90_000 });
  }

  await expect(
    page.getByRole("combobox", { name: /Línea de negocio/i }),
  ).toBeEnabled({ timeout: 90_000 });
}

export async function openSelect(select: Locator) {
  await expect(select).toBeEnabled();
  await select.click();
}

export async function chooseOptionByIndex(page: Page, select: Locator, index: number) {
  await openSelect(select);
  const content = page.locator(".ui-select-content");
  await expect(content).toBeVisible({ timeout: 30_000 });
  const options = content.getByRole("option");
  const count = await options.count();
  const boundedIndex = Math.max(0, Math.min(index, Math.max(count - 1, 0)));
  const option = options.nth(boundedIndex);
  await option.scrollIntoViewIfNeeded();
  await option.click();
}

export async function chooseOptionByName(
  page: Page,
  select: Locator,
  name: RegExp | string,
) {
  await openSelect(select);
  const content = page.locator(".ui-select-content");
  await expect(content).toBeVisible({ timeout: 30_000 });
  const option = content.getByRole("option", { name });
  await option.scrollIntoViewIfNeeded();
  await option.click();
}
