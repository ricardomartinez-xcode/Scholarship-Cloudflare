import { expect, test } from "@playwright/test";

import {
  chooseOptionByIndex,
  chooseOptionByName,
  loginAdmin,
  loginUser,
  requireAdminCredentials,
  requireUserCredentials,
  waitForCalculatorReady,
} from "./helpers";

async function fillValidQuote(page: import("@playwright/test").Page) {
  const tipo = page.getByRole("combobox", { name: /Tipo de inscripción/i });
  const nivel = page.getByRole("combobox", { name: /Línea de negocio/i });
  const modalidad = page.getByRole("combobox", { name: /Modalidad/i });
  const plan = page.getByRole("combobox", { name: /Plan de estudios/i });
  const plantel = page.getByRole("combobox", { name: /Plantel/i });
  const promedio = page.getByRole("textbox", { name: /Promedio/i });

  await chooseOptionByName(page, tipo, /Nuevo ingreso/i);
  await chooseOptionByIndex(page, nivel, 0);
  await chooseOptionByIndex(page, modalidad, 0);
  await chooseOptionByIndex(page, plan, 0);

  if (await plantel.isEnabled().catch(() => false)) {
    await chooseOptionByIndex(page, plantel, 0);
  }

  await promedio.fill("8.56");
}

test("user can create a personal template from the compact results panel", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { email, password } = requireUserCredentials();
  await loginUser(page, email, password);
  await waitForCalculatorReady(page);
  await fillValidQuote(page);

  const preview = page.getByTestId("whatsapp-preview");
  await expect(page.getByTestId("whatsapp-template-panel")).toBeVisible();
  await expect(preview).toHaveValue(/Precio lista:/i);

  const token = `CompactoE2E${Date.now()}`;
  await page.getByTestId("new-whatsapp-template-button").click();
  await page.getByTestId("whatsapp-template-name-input").fill(`E2E ${token}`);
  await page
    .getByTestId("whatsapp-template-base-text-input")
    .fill(`Hola, te comparto el seguimiento ${token}.`);
  await page.getByTestId("save-whatsapp-template-button").click();

  await expect(preview).toHaveValue(new RegExp(token));

  await page.reload();
  await waitForCalculatorReady(page);
  await fillValidQuote(page);
  await expect(page.getByTestId("whatsapp-preview")).toHaveValue(new RegExp(token));
});

test("admin can open the WhatsApp template review page", async ({ page }) => {
  test.setTimeout(120_000);
  const { email, password } = requireAdminCredentials();
  await loginAdmin(page, email, password);
  await page.getByRole("link", { name: /Templates WhatsApp/i }).click();

  await expect(
    page.getByRole("heading", { name: /Revisión y publicación/i }),
  ).toBeVisible();
});
